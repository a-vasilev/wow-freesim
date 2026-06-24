/**
 * Client-side "can this character equip this item" rules. The hard part isn't the
 * rules (they're tiny) — it's the per-item input, which we get from Wowhead
 * (wowheadItem.ts): item class + subclass (armor type) + any class restriction, as
 * NUMERIC ids parsed from the tooltip markers. Here we just apply the rules.
 *
 * Everything fails OPEN: if we can't determine an item's type/class (network
 * failure, unparseable tooltip), we treat it as usable rather than hide a possibly-
 * good item. The run-time error path is the final safety net for the rare miss.
 */
import type { ItemClassInfo } from './wowheadItem'

// In-game class ids (the values Wowhead uses in `/class=<id>/` and we map the simc
// class token to). NOT the class bitmask.
const NORM_CLASS_ID: Record<string, number> = {
  warrior: 1,
  paladin: 2,
  hunter: 3,
  rogue: 4,
  priest: 5,
  deathknight: 6,
  shaman: 7,
  mage: 8,
  warlock: 9,
  monk: 10,
  druid: 11,
  demonhunter: 12,
  evoker: 13,
}

/** The character's class id from the profile's `class="Name"` declaration line. */
export function classIdFromProfile(profile: string): number | undefined {
  const m =
    /^\s*(death_?knight|demon_?hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)\s*=/im.exec(
      profile,
    )
  if (!m) return undefined
  return NORM_CLASS_ID[m[1].toLowerCase().replace(/_/g, '')]
}

// Armor proficiency is cumulative: a class can wear its own armor type AND every
// lighter one (a plate class wears plate/mail/leather/cloth; a cloth class wears
// cloth only). Wowhead armor subclass ids: Cloth=1, Leather=2, Mail=3, Plate=4 —
// which double as the proficiency RANK. So an item is wearable when its subclass
// rank ≤ the class's max rank.
const CLASS_MAX_ARMOR_RANK: Record<number, number> = {
  1: 4, // Warrior  — Plate
  2: 4, // Paladin  — Plate
  3: 3, // Hunter   — Mail
  4: 2, // Rogue    — Leather
  5: 1, // Priest   — Cloth
  6: 4, // DK       — Plate
  7: 3, // Shaman   — Mail
  8: 1, // Mage     — Cloth
  9: 1, // Warlock  — Cloth
  10: 2, // Monk    — Leather
  11: 2, // Druid   — Leather
  12: 2, // DH      — Leather
  13: 3, // Evoker  — Mail
}

// Classes that can use a shield (Armor subclass 6) in the off hand.
const SHIELD_CLASSES = new Set([1, 2, 7]) // Warrior, Paladin, Shaman

// Wowhead item class ids.
const CLASS_ARMOR = 4
// Armor subclass ids that carry a proficiency rank.
const ARMOR_RANKS = new Set([1, 2, 3, 4]) // Cloth/Leather/Mail/Plate
const SUBCLASS_SHIELD = 6

// The 8 armor slots that enforce armor-type proficiency. Back/neck/finger/trinket
// are Armor too but universally equippable (cloaks are Cloth, jewelry is Misc), so
// the rank rule must NOT apply to them.
const PROFICIENCY_SLOTS = new Set([
  'head',
  'shoulders',
  'chest',
  'wrists',
  'hands',
  'waist',
  'legs',
  'feet',
])

/**
 * Can a character of `classId` equip `info` in `slot`? Fails open (true) when the
 * class or item type is unknown. Covers: explicit class restrictions (tier sets,
 * class-locked items), armor-type proficiency (the common bag/bank case), and
 * shields. Weapon-type proficiency is intentionally NOT enforced here (only the
 * explicit class restriction applies to weapons) — see WEB_UI_PLAN §7.
 */
export function isUsable(
  classId: number | undefined,
  slot: string,
  info: ItemClassInfo | null,
): boolean {
  if (!info || classId === undefined) return true

  // Explicit class lock (tier pieces, class-restricted weapons/trinkets).
  if (info.allowedClasses.length && !info.allowedClasses.includes(classId)) {
    return false
  }

  if (info.classId === CLASS_ARMOR) {
    if (info.subclassId === SUBCLASS_SHIELD) return SHIELD_CLASSES.has(classId)
    if (
      PROFICIENCY_SLOTS.has(slot) &&
      info.subclassId !== undefined &&
      ARMOR_RANKS.has(info.subclassId)
    ) {
      return info.subclassId <= (CLASS_MAX_ARMOR_RANK[classId] ?? 4)
    }
  }

  return true
}
