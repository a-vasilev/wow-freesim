/** Shared helpers for `.simc` profile text (used by Quick Sim and Top Gear). */

/** Heuristic: does this text look like a simc profile worth inspecting? Matches a
 *  leading `class="…"` declaration line. */
export function looksLikeProfile(text: string): boolean {
  return /^\s*(death_?knight|demon_?hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)\s*=/im.test(
    text,
  )
}
