/**
 * Adapter: simc `json2` (sprawling, version-y) → our normalized schemas. This is
 * the ONE place that knows simc's report shape. Field choices are pinned to a
 * real v1205.01 capture (scripts/capture-report.mjs); see src/engine/fixtures/.
 *
 * Strategy: navigate the raw payload through narrow local interfaces (no `any`),
 * build the compact normalized objects, then validate THOSE with Zod so a shape
 * drift surfaces here as a clear parse error rather than as `undefined` deep in
 * the UI.
 */
import {
  ParsedCharacterSchema,
  ProfilesetReportSchema,
  SimReportSchema,
  type AbilityBreakdown,
  type GearItem,
  type ParsedCharacter,
  type ProfilesetReport,
  type ProfilesetResult,
  type SampleStat,
  type SimReport,
  type Uptime,
} from './schemas'

// ── Minimal raw json2 shape (only the fields we read) ────────────────────────

interface RawSample {
  sum?: number
  count?: number
  mean?: number
  min?: number
  max?: number
  median?: number
  std_dev?: number
  mean_std_dev?: number
  pct?: number
}
interface RawDirectResult {
  pct?: number
  avg_actual_amount?: RawSample
}
interface RawStat {
  id?: number
  spell_name?: string
  name?: string
  school?: string
  type?: string
  num_executes?: RawSample
  /** Mean total damage for this stat INCLUDING its children — the basis for DPS. */
  compound_amount?: number
  portion_aps?: RawSample
  portion_amount?: number
  direct_results?: { crit?: RawDirectResult; hit?: RawDirectResult }
  children?: RawStat[]
}
interface RawGear {
  name?: string
  encoded_item?: string
  ilevel?: number
}
interface RawBuff {
  name?: string
  spell_name?: string
  spell?: number
  uptime?: number
  benefit?: number
}
interface RawPlayer {
  name?: string
  specialization?: string
  race?: string
  level?: number
  talents?: string
  gear?: Record<string, RawGear>
  stats?: RawStat[]
  stats_pets?: Record<string, RawStat[]>
  buffs?: RawBuff[]
  collected_data?: {
    dps?: RawSample
    timeline_dmg?: { data?: number[] }
  }
}
interface RawSimOptions {
  iterations?: number
  target_error?: number
  max_time?: number
  fight_style?: string
  desired_targets?: number
}
/** A `sim.profilesets.results[]` entry. NOTE the keys differ from RawSample:
 *  profilesets use `stddev`/`mean_stddev`, the player sample uses
 *  `std_dev`/`mean_std_dev` (verified against a real v1205.01 profileset run). */
interface RawProfilesetResult {
  name?: string
  mean?: number
  min?: number
  max?: number
  median?: number
  stddev?: number
  mean_stddev?: number
  mean_error?: number
  iterations?: number
}
interface RawJson2 {
  version?: string
  git_revision?: string
  build_date?: string
  timestamp?: string | number
  sim?: {
    options?: RawSimOptions
    players?: RawPlayer[]
    targets?: RawPlayer[]
    statistics?: { simulation_length?: RawSample }
    profilesets?: { metric?: string; results?: RawProfilesetResult[] }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function sample(s: RawSample | undefined): SampleStat | undefined {
  if (!s || typeof s.mean !== 'number') return undefined
  return {
    mean: s.mean,
    min: s.min,
    max: s.max,
    median: s.median,
    stddev: s.std_dev,
    meanStdDev: s.mean_std_dev,
  }
}

/** Parse a simc item string (`name,id=…,bonus_id=a/b,gem_id=…,enchant_id=…`). */
export function parseEncodedItem(
  slot: string,
  encoded: string,
  fallbackName?: string,
  ilvl?: number,
): GearItem | null {
  const parts = encoded.split(',')
  let name = fallbackName
  let itemId = 0
  const bonusIds: number[] = []
  const gemIds: number[] = []
  let enchantId: number | undefined

  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) {
      if (!name && part.trim()) name = part.trim()
      continue
    }
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    const nums = value
      .split('/')
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
    switch (key) {
      case 'id':
        itemId = nums[0] ?? 0
        break
      case 'bonus_id':
        bonusIds.push(...nums)
        break
      case 'gem_id':
        gemIds.push(...nums.filter((n) => n > 0))
        break
      case 'enchant_id':
        enchantId = nums[0]
        break
    }
  }
  if (!itemId) return null
  return { slot, itemId, name, ilvl, bonusIds, gemIds, enchantId, encodedItem: encoded }
}

function extractGear(player: RawPlayer): GearItem[] {
  const gear = player.gear ?? {}
  const items: GearItem[] = []
  for (const [slot, raw] of Object.entries(gear)) {
    if (!raw?.encoded_item) continue
    const item = parseEncodedItem(slot, raw.encoded_item, raw.name, raw.ilevel)
    if (item) items.push(item)
  }
  return items
}

function averageIlvl(gear: GearItem[]): number | undefined {
  const levels = gear.map((g) => g.ilvl).filter((n): n is number => typeof n === 'number')
  if (!levels.length) return undefined
  return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
}

/** Damage-weighted crit% across a stat's subtree (leaves carry direct_results +
 *  their own portion_aps as the weight). Used only for the advanced crit column;
 *  DPS itself comes from compound_amount (below). */
function subtreeCrit(s: RawStat): { weighted: number; weight: number } {
  let weighted = 0
  let weight = 0
  const crit = s.direct_results?.crit?.pct
  const w = s.portion_aps?.mean
  if (typeof crit === 'number' && typeof w === 'number' && w > 0) {
    weighted += crit * w
    weight += w
  }
  for (const child of s.children ?? []) {
    const sub = subtreeCrit(child)
    weighted += sub.weighted
    weight += sub.weight
  }
  return { weighted, weight }
}

function titleCase(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * One breakdown row per TOP-LEVEL action, for the player AND each pet/guardian.
 * DPS = `compound_amount / fightLength` — compound_amount already includes the
 * stat's children (no recursion), and simc puts a pet's damage in EITHER the
 * player stats OR `stats_pets`, never both, so summing player + pets lands at the
 * DPS headline (verified across Frost/Unholy/Arms). This matches simc's own report
 * and Raidbots; recursive portion_aps summing did not (some parents already
 * include their children).
 */
function extractAbilities(
  player: RawPlayer,
  fightLength: number,
  totalDps: number,
): AbilityBreakdown[] {
  const out: AbilityBreakdown[] = []
  const addStats = (stats: RawStat[] | undefined, petLabel?: string) => {
    for (const s of stats ?? []) {
      if (s.type !== 'damage' && s.type !== 'heal') continue
      const dps = (s.compound_amount ?? 0) / fightLength
      if (dps <= 0) continue
      const crit = subtreeCrit(s)
      const base = s.spell_name || s.name || 'Unknown'
      out.push({
        id: s.id ?? 0,
        name: petLabel ? `${base} (${petLabel})` : base,
        school: s.school,
        type: s.type,
        dps,
        damagePct: totalDps > 0 ? (dps / totalDps) * 100 : 0,
        casts: s.num_executes?.mean ?? 0,
        critPct: crit.weight > 0 ? crit.weighted / crit.weight : undefined,
      })
    }
  }
  addStats(player.stats)
  for (const [pet, stats] of Object.entries(player.stats_pets ?? {})) {
    addStats(stats, titleCase(pet))
  }
  return out.sort((a, b) => b.dps - a.dps)
}

function extractUptimes(buffs: RawBuff[] | undefined): Uptime[] {
  return (buffs ?? [])
    .filter((b) => typeof b.uptime === 'number')
    .map((b) => ({
      name: b.spell_name ?? b.name ?? 'Unknown',
      spellId: b.spell,
      uptimePct: b.uptime as number,
      benefitPct: b.benefit,
    }))
    .sort((a, b) => b.uptimePct - a.uptimePct)
}

function timestampString(ts: string | number | undefined): string | undefined {
  if (ts === undefined) return undefined
  return typeof ts === 'number' ? String(ts) : ts
}

// ── public adapter ───────────────────────────────────────────────────────────

function firstPlayer(raw: RawJson2): RawPlayer {
  const player = raw.sim?.players?.[0]
  if (!player) throw new Error('json2 has no players (sim failed to produce a result)')
  return player
}

/** Extract identity + gear + talents (the compose-screen preview). */
export function parseCharacter(json2: unknown): ParsedCharacter {
  const raw = json2 as RawJson2
  const player = firstPlayer(raw)
  const gear = extractGear(player)
  const character: ParsedCharacter = {
    name: player.name ?? 'Unknown',
    specialization: player.specialization ?? 'Unknown',
    race: player.race ?? 'unknown',
    level: player.level ?? 0,
    ilvl: averageIlvl(gear),
    gear,
    talents: {
      loadout: player.talents ?? '',
      selected: [],
    },
  }
  return ParsedCharacterSchema.parse(character)
}

/** Extract the full render-ready report. */
export function parseSimReport(json2: unknown): SimReport {
  const raw = json2 as RawJson2
  const player = firstPlayer(raw)
  const options = raw.sim?.options ?? {}
  const gear = extractGear(player)
  const dps = sample(player.collected_data?.dps)
  if (!dps) throw new Error('json2 player has no DPS result')
  // Mean fight length drives per-ability DPS (compound_amount / fightLength).
  const fightLength =
    raw.sim?.statistics?.simulation_length?.mean ?? options.max_time ?? 300

  const report: SimReport = {
    meta: {
      simcVersion: raw.version ?? 'unknown',
      gitRevision: raw.git_revision,
      buildDate: raw.build_date,
      timestamp: timestampString(raw.timestamp),
      fightStyle: options.fight_style,
      targets: options.desired_targets,
      fightLength: options.max_time,
      iterations: options.iterations ?? 0,
      targetError: options.target_error || undefined,
    },
    character: {
      name: player.name ?? 'Unknown',
      specialization: player.specialization ?? 'Unknown',
      race: player.race ?? 'unknown',
      level: player.level ?? 0,
      ilvl: averageIlvl(gear),
    },
    dps,
    abilities: extractAbilities(player, fightLength, dps.mean),
    buffs: extractUptimes(player.buffs),
    debuffs: extractUptimes(raw.sim?.targets?.[0]?.buffs),
    damageTimeline: player.collected_data?.timeline_dmg?.data,
  }
  return SimReportSchema.parse(report)
}

/** Map a profileset result's flat fields into our SampleStat shape. */
function profilesetSample(r: RawProfilesetResult): SampleStat {
  return {
    mean: r.mean ?? 0,
    min: r.min,
    max: r.max,
    median: r.median,
    stddev: r.stddev,
    meanStdDev: r.mean_stddev,
  }
}

/**
 * Extract a Top Gear profileset batch: the base profile (current gear) result as
 * the `baseline` anchor + every profileset result. Unsorted; the UI ranks them.
 */
export function parseProfilesetReport(
  json2: unknown,
  baselineName = 'Current gear',
): ProfilesetReport {
  const raw = json2 as RawJson2
  const player = firstPlayer(raw)
  const options = raw.sim?.options ?? {}
  const baseSample = sample(player.collected_data?.dps)
  if (!baseSample) throw new Error('json2 player has no DPS result (base profile failed)')

  const baseline: ProfilesetResult = {
    name: baselineName,
    dps: baseSample,
    meanError:
      baseSample.meanStdDev != null ? baseSample.meanStdDev * 1.96 : undefined,
    iterations: options.iterations,
  }
  const sets: ProfilesetResult[] = (raw.sim?.profilesets?.results ?? []).map(
    (r) => ({
      name: r.name ?? 'Unknown',
      dps: profilesetSample(r),
      meanError: r.mean_error,
      iterations: r.iterations,
    }),
  )

  const report: ProfilesetReport = {
    meta: {
      simcVersion: raw.version ?? 'unknown',
      fightStyle: options.fight_style,
      targets: options.desired_targets,
      fightLength: options.max_time,
      iterations: options.iterations ?? 0,
      targetError: options.target_error || undefined,
    },
    metric: raw.sim?.profilesets?.metric ?? 'Damage per Second',
    baseline,
    sets,
  }
  return ProfilesetReportSchema.parse(report)
}
