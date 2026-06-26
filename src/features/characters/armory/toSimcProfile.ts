/**
 * Pure transform: the Armory Function payload → a SimulationCraft profile string.
 *
 * The produced string is shaped so the rest of the pipeline works for free:
 *   - header lines (`warrior="Name"`, `level=`, `race=`, `region=`, `server=`,
 *     `spec=`) are exactly what src/features/characters/parseIdentity.ts reads, so
 *     identity + Save-to-library light up with no extra work;
 *   - gear lines reuse the canonical simc item fragment
 *     (`slot=Name,id=…,bonus_id=a/b,gem_id=x/y,enchant_id=z`) that
 *     src/engine/json2.ts (parseEncodedItem) + profilesets.ts already speak.
 *
 * Nothing here is async and nothing imports the engine — it's a string builder.
 * The Function response is parsed with zod first (src/engine/schemas.ts pattern),
 * so malformed upstream data fails loud instead of producing a half-built profile.
 */
import { z } from 'zod'

// ── Function payload schema (narrow — only the fields we read) ────────────────

const RealmSchema = z.object({ slug: z.string().optional() }).loose()

const SummarySchema = z
  .object({
    name: z.string(),
    level: z.number().optional(),
    character_class: z.object({ name: z.string().optional() }).loose().optional(),
    race: z.object({ name: z.string().optional() }).loose().optional(),
    active_spec: z.object({ name: z.string().optional() }).loose().optional(),
    realm: RealmSchema.optional(),
  })
  .loose()

const EnchantmentSchema = z
  .object({
    enchantment_id: z.number().optional(),
    enchantment_slot: z.object({ type: z.string().optional() }).loose().optional(),
  })
  .loose()

const SocketSchema = z
  .object({
    item: z.object({ id: z.number().optional() }).loose().optional(),
  })
  .loose()

const EquippedItemSchema = z
  .object({
    item: z.object({ id: z.number().optional() }).loose().optional(),
    slot: z.object({ type: z.string().optional() }).loose().optional(),
    name: z.string().optional(),
    bonus_list: z.array(z.number()).optional(),
    sockets: z.array(SocketSchema).optional(),
    enchantments: z.array(EnchantmentSchema).optional(),
  })
  .loose()

const EquipmentSchema = z
  .object({
    equipped_items: z.array(EquippedItemSchema).optional(),
  })
  .loose()

/**
 * Specializations endpoint. Blizzard's payload no longer carries the talent
 * loadout import string (broken since patch 11.2). We probe a couple of plausible
 * field names so this lights up automatically if Blizzard restores it; until then
 * the talents are simply omitted and the UI shows a non-blocking notice.
 */
const SpecializationsSchema = z
  .object({
    active_specialization: z.object({ name: z.string().optional() }).loose().optional(),
    // Possible homes for a future talent code — all optional, all probed.
    selected_loadout_code: z.string().optional(),
    talent_loadouts_code: z.string().optional(),
  })
  .loose()

export const ArmoryPayloadSchema = z.object({
  region: z.string(),
  summary: SummarySchema,
  equipment: EquipmentSchema,
  specializations: SpecializationsSchema,
})

export type ArmoryPayload = z.infer<typeof ArmoryPayloadSchema>

export interface SimcProfileResult {
  /** The assembled `.simc` profile string (header + gear, optional talents). */
  profile: string
  /** True when Blizzard supplied a talent loadout code (currently ~never). */
  hasTalents: boolean
}

// ── Token mapping ────────────────────────────────────────────────────────────

/** simc class option token (lowercase, no spaces) from a Blizzard class name. */
function classToken(className: string): string {
  // Blizzard: "Death Knight"/"Demon Hunter" → simc: death_knight/demon_hunter.
  return className.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Lowercase + underscore a Blizzard name into a simc race/spec token. */
function token(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '_')
}

/**
 * Blizzard equipment `slot.type` → canonical simc slot key. Mirrors the alias
 * intent of src/features/gear/gearModel.ts (shoulder→shoulders, etc.) but keyed on
 * Blizzard's enum tokens (HEAD, FINGER_1, MAIN_HAND, …). SHIRT/TABARD are cosmetic
 * and intentionally dropped (simc ignores them).
 */
const SLOT_MAP: Record<string, string> = {
  HEAD: 'head',
  NECK: 'neck',
  SHOULDER: 'shoulders',
  BACK: 'back',
  CHEST: 'chest',
  WRIST: 'wrists',
  HANDS: 'hands',
  WAIST: 'waist',
  LEGS: 'legs',
  FEET: 'feet',
  FINGER_1: 'finger1',
  FINGER_2: 'finger2',
  TRINKET_1: 'trinket1',
  TRINKET_2: 'trinket2',
  MAIN_HAND: 'main_hand',
  OFF_HAND: 'off_hand',
}

/** simc item-name token from Blizzard's display name (cosmetic; Wowhead renders). */
function nameToken(name: string | undefined): string {
  if (!name) return 'item'
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'item'
  )
}

/** Build the `slot=Name,id=…,bonus_id=…,gem_id=…,enchant_id=…` fragment for one item. */
function itemLine(
  item: z.infer<typeof EquippedItemSchema>,
): string | null {
  const slotType = item.slot?.type
  const id = item.item?.id
  if (!slotType || !id) return null
  const slotKey = SLOT_MAP[slotType]
  if (!slotKey) return null // SHIRT, TABARD, cosmetic — skip cleanly.

  const parts = [`${slotKey}=${nameToken(item.name)}`, `id=${id}`]

  const bonusIds = (item.bonus_list ?? []).filter((n) => Number.isFinite(n))
  if (bonusIds.length) parts.push(`bonus_id=${bonusIds.join('/')}`)

  const gemIds = (item.sockets ?? [])
    .map((s) => s.item?.id)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  if (gemIds.length) parts.push(`gem_id=${gemIds.join('/')}`)

  // PERMANENT enchant slot only — Blizzard also lists temporary/on-use/socket
  // enchant entries we must not emit as the item's enchant_id.
  const permanent = (item.enchantments ?? []).find(
    (e) => e.enchantment_slot?.type === 'PERMANENT',
  )
  if (permanent?.enchantment_id) parts.push(`enchant_id=${permanent.enchantment_id}`)

  return parts.join(',')
}

/** Probe the specializations payload for a talent loadout code (currently absent). */
function extractTalentCode(spec: z.infer<typeof SpecializationsSchema>): string | undefined {
  return spec.selected_loadout_code || spec.talent_loadouts_code || undefined
}

/**
 * Build the simc profile from an already-validated Function payload. Throws (via
 * zod) on malformed input — call with the parsed result of `ArmoryPayloadSchema`.
 */
export function toSimcProfile(payload: ArmoryPayload): SimcProfileResult {
  const { region, summary, equipment, specializations } = payload

  const className = summary.character_class?.name ?? ''
  const classKey = classToken(className)
  const realmSlug =
    summary.realm?.slug ??
    // Fall back to the region echoed by the Function only if realm slug is absent.
    ''
  const specName =
    summary.active_spec?.name ?? specializations.active_specialization?.name ?? ''

  const header: string[] = []
  // Class declaration line MUST come first so parseIdentity's CLASS_LINE matches.
  header.push(`${classKey}="${summary.name}"`)
  if (typeof summary.level === 'number') header.push(`level=${summary.level}`)
  if (summary.race?.name) header.push(`race=${token(summary.race.name)}`)
  header.push(`region=${region}`)
  if (realmSlug) header.push(`server=${realmSlug}`)
  if (specName) header.push(`spec=${token(specName)}`)

  const talentCode = extractTalentCode(specializations)
  if (talentCode) header.push(`talents=${talentCode}`)

  const gear = (equipment.equipped_items ?? [])
    .map(itemLine)
    .filter((line): line is string => line !== null)

  const profile = [...header, '', ...gear, ''].join('\n')

  return { profile, hasTalents: Boolean(talentCode) }
}
