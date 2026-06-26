/**
 * Character library model (CHARACTER_PERSISTENCE §3.1). A **Character** is a toon
 * (name + realm + class + race) that owns one or more named **Loadouts** (spec /
 * build variants). You sim by picking a character + a loadout.
 *
 * Loadouts are stored nested on the character row — small, always loaded together,
 * never queried independently (no separate Dexie table). The library itself lands
 * in Phase 2; these shapes exist from Phase 1 so the active-draft store and the
 * `buildProfile` seam can reference them without a later refactor.
 */

/**
 * One in-app structural gear change, in the same shape Top Gear already produces
 * (features/gear/profilesets.ts): one `slot=item,id=…,bonus_id=…,…` fragment per
 * changed slot. EMPTY in Phase 1–2; populated by the item-search feature in Phase 3.
 */
export interface GearOverride {
  /** simc slot key: head, finger1, trinket2, … */
  slot: string
  /** the raw simc override line */
  fragment: string
}

export interface Loadout {
  id: string
  /** user label: "Arms — Raid", "Fury — M+" */
  name: string
  /** e.g. "arms" */
  spec: string
  /** imported simc paste (talents, APL, gear snapshot) */
  base: string
  /** in-app structural changes; EMPTY in Phase 1–2 */
  edits: GearOverride[]
  /** derived from last inspect, for display */
  ilvl?: number
  updatedAt: number
}

export interface Character {
  id: string
  /** match key (§2.2); realm may be absent in the addon paste */
  identity: { name: string; realm: string | null }
  /** stable across loadouts (e.g. "warrior") */
  className: string
  race: string
  loadouts: Loadout[]
  /** last-used loadout for this character */
  activeLoadoutId: string
  createdAt: number
  updatedAt: number
}
