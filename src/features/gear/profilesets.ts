/**
 * Turn enumerated gear combinations into simc profilesets. Each set overrides
 * only the slots that DIFFER from the equipped baseline (smaller input, and the
 * diff is exactly what the result table shows). The all-equipped combo is dropped
 * — it's the baseline, which simc reports separately from the base profile run.
 */
import type { GearItem, ProfilesetOverride } from '@/engine'
import type { Combo } from './combos'
import type { GearModel } from './gearModel'

export interface SetChange {
  slot: string
  label: string
  item: GearItem
}

export interface PlannedSet {
  /** simc-safe unique set name (`tg<n>`); maps a result row back to its changes. */
  name: string
  overrides: ProfilesetOverride['overrides']
  /** Items changed vs. the equipped baseline — drives the result row display. */
  changes: SetChange[]
}

/** Plan profilesets from combos. Returns only sets that change ≥1 slot. */
export function planProfilesets(
  model: GearModel,
  combos: Combo[],
): PlannedSet[] {
  const slotByKey = new Map(model.slots.map((s) => [s.key, s]))
  const plans: PlannedSet[] = []
  let n = 0

  for (const combo of combos) {
    const overrides: string[] = []
    const changes: SetChange[] = []
    for (const [slotKey, pick] of Object.entries(combo.picks)) {
      const slot = slotByKey.get(slotKey)
      if (!slot || pick.uid === slot.equippedUid) continue
      // `<slot>=<encoded item>` — encodedItem already carries id/bonus/gem/enchant.
      overrides.push(`${slotKey}=${pick.item.encodedItem}`)
      changes.push({ slot: slotKey, label: slot.label, item: pick.item })
    }
    if (overrides.length === 0) continue // baseline combo
    n += 1
    plans.push({ name: `tg${n}`, overrides, changes })
  }

  return plans
}
