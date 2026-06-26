/**
 * The `buildProfile` seam (CHARACTER_PERSISTENCE §5.3) — the single place every
 * engine call turns a loadout/draft into final `.simc` text.
 *
 * Phase 1–2: `edits` is always empty, so this returns `base` verbatim — an
 * identity function with zero behavior change. Phase 3: the item-search feature
 * pushes `GearOverride`s into `edits` and this composes `base + edits`. Because
 * every run path already routes through here and the engine seam is string-based,
 * that feature becomes purely additive — no downstream plumbing changes.
 */
import type { GearOverride, Loadout } from './types'

/** Compose a loadout's source into final `.simc` text. */
export function buildProfile(loadout: Pick<Loadout, 'base' | 'edits'>): string {
  return compose(loadout.base, loadout.edits)
}

/** Same, for the active draft (which carries `base` + `edits` directly). */
export function buildProfileFromDraft(
  draft: { base: string; edits: GearOverride[] },
): string {
  return compose(draft.base, draft.edits)
}

/**
 * Append each override fragment after the base profile. simc applies later lines
 * over earlier ones, so a per-slot override line supersedes the imported slot.
 * With no edits this is a no-op and returns `base` unchanged.
 */
function compose(base: string, edits: GearOverride[]): string {
  if (edits.length === 0) return base
  return [base, ...edits.map((e) => e.fragment)].join('\n')
}
