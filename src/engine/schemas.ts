/**
 * The engine I/O contract — our OWN normalized, compact schemas, NOT a 1:1 of
 * simc's sprawling `json2`. The adapter in `json2.ts` maps real simc output into
 * these shapes; the UI only ever sees these. Modeled against a REAL `json2`
 * capture from simc-wasm v1205.01 (see scripts/capture-report.mjs +
 * src/engine/fixtures/). Decoupling here means a simc report-shape change is
 * absorbed in one adapter, not across the UI.
 */
import { z } from 'zod'

// ── Engine identity / capabilities ──────────────────────────────────────────

export const EngineInfoSchema = z.object({
  /** Which implementation answered: the real wasm engine or a stand-in. */
  implementation: z.enum(['wasm', 'mock']),
  /** simc version string (e.g. "1205-01") or git revision. */
  version: z.string(),
  /** Whether SharedArrayBuffer/threads are actually available. */
  crossOriginIsolated: z.boolean(),
  /** Logical cores reported by the host (navigator.hardwareConcurrency). */
  cores: z.number().int().nonnegative(),
  /** Worker/thread pool size the engine will actually use. */
  threads: z.number().int().nonnegative(),
})
export type EngineInfo = z.infer<typeof EngineInfoSchema>

// ── Sim options (the shared fight-style / length / targets / precision controls)

export const FIGHT_STYLES = [
  'Patchwerk',
  'DungeonSlice',
  'HecticAddCleave',
  'CleaveAdd',
  'HelterSkelter',
  'LightMovement',
  'HeavyMovement',
  'Ultraxion',
] as const
export type FightStyle = (typeof FIGHT_STYLES)[number]

export const SimOptionsSchema = z.object({
  /** simc `fight_style=`. */
  fightStyle: z.enum(FIGHT_STYLES),
  /** simc `desired_targets=` (1 = single target). */
  targets: z.number().int().min(1).max(30),
  /** simc `max_time=` in seconds. */
  fightLength: z.number().int().min(30).max(1200),
  /**
   * Precision — the main client-side performance lever (WEB_UI_PLAN §6.1).
   * `targetError` drives simc `target_error=` (run until convergence); when
   * unset, `iterations` pins a fixed count. Exactly one is the active control.
   */
  targetError: z.number().min(0).max(2).optional(),
  iterations: z.number().int().min(100).max(1_000_000).optional(),
})
export type SimOptions = z.infer<typeof SimOptionsSchema>

export const DEFAULT_SIM_OPTIONS: SimOptions = {
  fightStyle: 'Patchwerk',
  targets: 1,
  fightLength: 300,
  targetError: 0.2,
}

export const SimInputSchema = z.object({
  /** Raw `.simc` profile text (the `/simc` addon paste or Advanced-mode editor). */
  profile: z.string().min(1),
  options: SimOptionsSchema,
})
export type SimInput = z.infer<typeof SimInputSchema>

// ── Parsed character (id-centric; rich display comes from Wowhead at runtime) ──

export const GearItemSchema = z.object({
  /** simc slot key: head, neck, shoulders, …, main_hand, off_hand. */
  slot: z.string(),
  itemId: z.number().int().positive(),
  /** simc's name token (e.g. "night_enders_tusks"); display name is Wowhead's job. */
  name: z.string().optional(),
  ilvl: z.number().int().optional(),
  bonusIds: z.array(z.number().int()),
  gemIds: z.array(z.number().int()),
  enchantId: z.number().int().optional(),
  /**
   * The raw simc item string (`id=…,bonus_id=…,gem_id=…,enchant_id=…`). Drives
   * the Wowhead "Power" tooltip directly — the params map 1:1.
   */
  encodedItem: z.string(),
})
export type GearItem = z.infer<typeof GearItemSchema>

export const TalentNodeSchema = z.object({
  id: z.number().int(),
  rank: z.number().int(),
})

export const ParsedCharacterSchema = z.object({
  name: z.string(),
  /** simc's full spec label, e.g. "Arms Warrior". */
  specialization: z.string(),
  className: z.string().optional(),
  race: z.string(),
  level: z.number().int(),
  /** Average equipped item level (derived from gear; simc omits a player ilvl). */
  ilvl: z.number().int().optional(),
  gear: z.array(GearItemSchema),
  talents: z.object({
    /** The import/loadout string (decodes to nodes only with the tree definition). */
    loadout: z.string(),
    /** Selected nodes when simc emits them; empty until the tree bundle lands. */
    selected: z.array(TalentNodeSchema),
  }),
})
export type ParsedCharacter = z.infer<typeof ParsedCharacterSchema>

// ── Sim report (the render input) ────────────────────────────────────────────

/** A simc sample_data summary (mean + spread). The per-iteration distribution is
 *  NOT in json2 — see note on SimReport.distribution. */
export const SampleStatSchema = z.object({
  mean: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  median: z.number().optional(),
  stddev: z.number().optional(),
  meanStdDev: z.number().optional(),
})
export type SampleStat = z.infer<typeof SampleStatSchema>

export const AbilityBreakdownSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  school: z.string().optional(),
  type: z.string(),
  /** Damage per second contributed (simc `portion_aps.mean`). */
  dps: z.number(),
  /** Share of total damage, 0–100 (simc `portion_amount` × 100). */
  damagePct: z.number(),
  /** Average casts/executes per iteration (simc `num_executes.mean`). */
  casts: z.number(),
  // ── advanced disclosure (free from json2) ──
  critPct: z.number().optional(),
  hitAvg: z.number().optional(),
  critAvg: z.number().optional(),
})
export type AbilityBreakdown = z.infer<typeof AbilityBreakdownSchema>

export const UptimeSchema = z.object({
  name: z.string(),
  spellId: z.number().int().optional(),
  /** Uptime percentage, 0–100. */
  uptimePct: z.number(),
  benefitPct: z.number().optional(),
})
export type Uptime = z.infer<typeof UptimeSchema>

export const SimReportSchema = z.object({
  meta: z.object({
    simcVersion: z.string(),
    gitRevision: z.string().optional(),
    buildDate: z.string().optional(),
    timestamp: z.string().optional(),
    fightStyle: z.string().optional(),
    targets: z.number().int().optional(),
    fightLength: z.number().optional(),
    iterations: z.number().int(),
    targetError: z.number().optional(),
  }),
  character: z.object({
    name: z.string(),
    specialization: z.string(),
    race: z.string(),
    level: z.number().int(),
    ilvl: z.number().int().optional(),
  }),
  dps: SampleStatSchema,
  abilities: z.array(AbilityBreakdownSchema),
  buffs: z.array(UptimeSchema),
  debuffs: z.array(UptimeSchema),
  /** Damage-over-fight-time buckets (simc `collected_data.timeline_dmg.data`). */
  damageTimeline: z.array(z.number()).optional(),
  /**
   * The per-iteration DPS distribution histogram. simc's `json2` does NOT export
   * it (sample_data serializes only mean/min/max/median/std_dev; the histogram in
   * simc's own HTML report is built in-memory and never reaches json2 — verified
   * against v1205.01 at statistics_level=3). The report derives an approximate
   * curve from mean+stddev for now; this slot holds real bins if a later engine
   * patch emits them. See WEB_UI_PLAN §6.4 / §8.13.
   */
  distribution: z
    .array(z.object({ dps: z.number(), count: z.number() }))
    .optional(),
})
export type SimReport = z.infer<typeof SimReportSchema>

// ── Progress (streamed during run()) ─────────────────────────────────────────

export const ProgressSchema = z.object({
  phase: z.enum(['init', 'running', 'merging', 'done']),
  /** 0–1 completion. */
  pct: z.number().min(0).max(1),
  iterations: z.number().int().optional(),
  totalIterations: z.number().int().optional(),
  /** Converging DPS estimate for the live preview. */
  currentDps: z.number().optional(),
  targetError: z.number().optional(),
  elapsedMs: z.number().optional(),
})
export type Progress = z.infer<typeof ProgressSchema>
