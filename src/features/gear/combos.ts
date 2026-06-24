/**
 * Top Gear combination generation (OVERALL_PLAN §7). The user selects candidate
 * items per slot; we take the cartesian product across slots to enumerate gear
 * sets, then drop invalid pairings (the same ring/trinket in both paired slots).
 *
 * Combinatorial blowup is the risk: a few options across several slots explodes
 * fast. So callers check `comboCount()` against the caps BEFORE generating, the UI
 * shows the count live, and Run is disabled past `MAX_COMBOS`.
 */
import type { CandidateItem, GearModel } from './gearModel'

/** Soft caution threshold — sims still run, but it'll take a while. */
export const WARN_COMBOS = 50
/** Hard ceiling for one client-side batch (each combo is a full sim). */
export const MAX_COMBOS = 500

/** slotKey → selected candidate uids. */
export type Selection = Record<string, string[]>

/** Default: each equipped slot considers only its equipped item (= baseline). */
export function defaultSelection(model: GearModel): Selection {
  const sel: Selection = {}
  for (const s of model.slots) sel[s.key] = s.equippedUid ? [s.equippedUid] : []
  return sel
}

/** Theoretical combination count = product of per-slot selected counts. Slots
 *  with no selection keep their equipped item (factor 1) and don't multiply. */
export function comboCount(model: GearModel, sel: Selection): number {
  let n = 1
  for (const s of model.slots) {
    const k = sel[s.key]?.length ?? 0
    if (k > 0) n *= k
  }
  return n
}

/** True when a slot is being varied (more than its single equipped pick). */
export function slotIsVaried(
  slot: { key: string; equippedUid?: string },
  sel: Selection,
): boolean {
  const picks = sel[slot.key] ?? []
  if (picks.length > 1) return true
  return picks.length === 1 && picks[0] !== slot.equippedUid
}

export interface Combo {
  /** slotKey → chosen candidate for this set. */
  picks: Record<string, CandidateItem>
}

/** Enumerate gear sets from the selection (cartesian product + paired-slot dedup).
 *  Only call when `comboCount` ≤ MAX_COMBOS; the product is bounded by that. */
export function generateCombos(model: GearModel, sel: Selection): Combo[] {
  const axes = model.slots
    .map((s) => ({
      key: s.key,
      items: (sel[s.key] ?? [])
        .map((uid) => s.candidates.find((c) => c.uid === uid))
        .filter((c): c is CandidateItem => !!c),
    }))
    .filter((a) => a.items.length > 0)

  let combos: Combo[] = [{ picks: {} }]
  for (const axis of axes) {
    const next: Combo[] = []
    for (const combo of combos) {
      for (const item of axis.items) {
        next.push({ picks: { ...combo.picks, [axis.key]: item } })
      }
    }
    combos = next
  }
  return combos.filter(validPairing)
}

/** Reject sets that place the same physical item in both finger or both trinket
 *  slots (you can't equip one ring twice). */
function validPairing(combo: Combo): boolean {
  const f1 = combo.picks['finger1']?.uid
  const f2 = combo.picks['finger2']?.uid
  if (f1 && f2 && f1 === f2) return false
  const t1 = combo.picks['trinket1']?.uid
  const t2 = combo.picks['trinket2']?.uid
  if (t1 && t2 && t1 === t2) return false
  return true
}
