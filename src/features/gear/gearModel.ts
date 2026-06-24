/**
 * Parse a `/simc` profile's RAW TEXT into a Top Gear candidate model: per-slot
 * equipped item + every alternative the addon exported in the bag/bank section.
 *
 * Why raw text (not `inspect()`/json2): simc IGNORES the commented bag/bank lines
 * when it sims, so they never reach json2 — yet they are exactly the candidate
 * pool for profile-scoped Top Gear ("best combination of what I already have",
 * WEB_UI_PLAN §7 / 2a). So we read both the equipped slot lines and the commented
 * bag lines straight from the text. No item catalog needed (that's 2b); display
 * comes from Wowhead by id.
 */
import { parseEncodedItem, type GearItem } from '@/engine'
import { SLOT_ORDER } from '@/features/character/slots'

/** Non-canonical slot tokens some exports use → our canonical SLOT_ORDER keys. */
const SLOT_ALIASES: Record<string, string> = {
  shoulder: 'shoulders',
  wrist: 'wrists',
  hand: 'hands',
  leg: 'legs',
  foot: 'feet',
  ring1: 'finger1',
  ring2: 'finger2',
}
const KNOWN_SLOTS = new Set(SLOT_ORDER.map((s) => s.key))

function canonicalSlot(token: string): string | null {
  const key = SLOT_ALIASES[token] ?? token
  return KNOWN_SLOTS.has(key) ? key : null
}

/** Rings and trinkets share one candidate pool across their two physical slots
 *  (a ring can go in either finger slot); everything else is its own group. */
export function slotGroup(slot: string): string {
  if (slot === 'finger1' || slot === 'finger2') return 'finger'
  if (slot === 'trinket1' || slot === 'trinket2') return 'trinket'
  return slot
}

export interface CandidateItem {
  /** Stable unique key — the raw simc item string (carries id+bonus+gem+enchant). */
  uid: string
  item: GearItem
  /** Where it came from in the profile: currently equipped vs. bags/bank. */
  source: 'equipped' | 'bags'
}

export interface GearSlot {
  /** Physical slot key, e.g. `finger1`. */
  key: string
  label: string
  /** Pool group (`finger`/`trinket`/own key) — paired slots share a pool. */
  group: string
  /** All selectable items for this slot (the group's shared pool). */
  candidates: CandidateItem[]
  /** The item equipped in this physical slot — the baseline pick. */
  equippedUid?: string
}

export interface GearModel {
  /** Equipped physical slots, in paperdoll order. */
  slots: GearSlot[]
}

// A gear line: optional leading `#` (bags), a slot token, `=`, then the item
// string. Must carry an `id=<n>` to count as a real item (skips commented APL,
// consumables, etc. — none of which match a gear slot token followed by `id=`).
const GEAR_LINE = /^(#?)\s*([a-z_]+[12]?)\s*=\s*(.+?)\s*$/i

/** Parse equipped + bag/bank gear from raw `/simc` text into the Top Gear model. */
export function parseGearModel(profile: string): GearModel {
  interface Entry {
    slot: string
    group: string
    item: GearItem
    source: 'equipped' | 'bags'
  }
  const entries: Entry[] = []

  for (const line of profile.split(/\r?\n/)) {
    const m = GEAR_LINE.exec(line)
    if (!m) continue
    const slot = canonicalSlot(m[2].toLowerCase())
    if (!slot) continue
    const value = m[3]
    if (!/\bid=\d+/.test(value)) continue
    const item = parseEncodedItem(slot, value)
    if (!item) continue
    entries.push({
      slot,
      group: slotGroup(slot),
      item,
      source: m[1] === '#' ? 'bags' : 'equipped',
    })
  }

  // Candidate pool per group (dedup by uid; an equipped copy outranks a bag copy).
  const poolByGroup = new Map<string, Map<string, CandidateItem>>()
  const equippedBySlot = new Map<string, string>()
  for (const e of entries) {
    const uid = e.item.encodedItem
    let pool = poolByGroup.get(e.group)
    if (!pool) poolByGroup.set(e.group, (pool = new Map()))
    const existing = pool.get(uid)
    if (!existing || (existing.source === 'bags' && e.source === 'equipped')) {
      pool.set(uid, { uid, item: e.item, source: e.source })
    }
    if (e.source === 'equipped') equippedBySlot.set(e.slot, uid)
  }

  // Surface only physical slots the character actually has equipped — keeps the
  // paperdoll real (no phantom off_hand) while still enriching each slot's pool
  // with bag alternatives from its group.
  const slots: GearSlot[] = SLOT_ORDER.filter((s) =>
    equippedBySlot.has(s.key),
  ).map((s) => {
    const group = slotGroup(s.key)
    return {
      key: s.key,
      label: s.label,
      group,
      candidates: orderCandidates([
        ...(poolByGroup.get(group)?.values() ?? []),
      ]),
      equippedUid: equippedBySlot.get(s.key),
    }
  })

  return { slots }
}

/** Equipped items first, then bags; stable otherwise. */
function orderCandidates(items: CandidateItem[]): CandidateItem[] {
  return [...items].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'equipped' ? -1 : 1
    return 0
  })
}
