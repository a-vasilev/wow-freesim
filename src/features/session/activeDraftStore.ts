import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GearOverride } from '@/features/characters/types'

/**
 * The one shared working profile every sim tab edits (CHARACTER_PERSISTENCE §3 /
 * §5.1). Editing it in any tab changes it everywhere — that's what makes the
 * Quick-Sim → Top-Gear auto-populate fall out for free. Persisted to localStorage
 * (`ilvl:active`) so the last input survives reloads (cold-start seeding, §2.7):
 * the unbound draft *is* the last-used simc string.
 *
 * The draft is either **bound** to a specific loadout (editing it marks that
 * loadout dirty) or **unbound** (a scratch paste). The Character library that
 * `bound`/`bind` point into lands in Phase 2; in Phase 1 the draft is always
 * unbound, but the shape exists now so no later refactor is needed.
 */
interface ActiveDraftState {
  /** imported / pasted simc text */
  base: string
  /** in-app structural changes; EMPTY until Phase 3 */
  edits: GearOverride[]
  /** the loadout this draft mirrors, or null when it's a scratch paste */
  bound: { characterId: string; loadoutId: string } | null
  /** base/edits differ from the bound loadout (always false while unbound) */
  dirty: boolean
  /**
   * The last unbound scratch paste, stashed when binding a loadout so the
   * switcher's "Unsaved paste" entry (§7.1) can return to it. This is a single
   * scratch buffer, NOT a per-character draft (§2.5) — there's still exactly one
   * active draft; this just remembers the text the draft held before it was bound.
   */
  lastUnboundBase: string

  /** Replace the working profile text; marks dirty only when bound. */
  setBase: (base: string) => void
  /** Replace the structural edits; marks dirty only when bound (Phase 3). */
  setEdits: (edits: GearOverride[]) => void
  /**
   * Point the draft at a loadout and treat it as clean. Low-level: records the
   * binding + resets `dirty` only. Use `selectLoadout` to also load content.
   */
  bind: (characterId: string, loadoutId: string) => void
  /** Detach from any loadout (back to a scratch paste). */
  unbind: () => void
  /**
   * Load a loadout into the draft and bind to it (the switcher's step-2 action).
   * Stashes the current scratch first when unbound, so "Unsaved paste" can return.
   */
  selectLoadout: (
    bound: { characterId: string; loadoutId: string },
    base: string,
    edits: GearOverride[],
  ) => void
  /** Return to the remembered unbound scratch paste (the switcher footer). */
  selectUnbound: () => void
  /** Reset to an empty, unbound draft. */
  clear: () => void
}

export const useActiveDraft = create<ActiveDraftState>()(
  persist(
    (set) => ({
      base: '',
      edits: [],
      bound: null,
      dirty: false,
      lastUnboundBase: '',

      setBase: (base) =>
        set((s) => ({ base, dirty: s.bound != null ? true : false })),
      setEdits: (edits) =>
        set((s) => ({ edits, dirty: s.bound != null ? true : false })),
      bind: (characterId, loadoutId) =>
        set({ bound: { characterId, loadoutId }, dirty: false }),
      unbind: () => set({ bound: null, dirty: false }),
      selectLoadout: (bound, base, edits) =>
        set((s) => ({
          base,
          edits,
          bound,
          dirty: false,
          // Stash the scratch only when leaving an unbound draft (don't clobber it
          // when hopping straight from one loadout to another).
          lastUnboundBase: s.bound == null ? s.base : s.lastUnboundBase,
        })),
      selectUnbound: () =>
        set((s) => ({
          base: s.bound == null ? s.base : s.lastUnboundBase,
          edits: [],
          bound: null,
          dirty: false,
        })),
      clear: () =>
        set({ base: '', edits: [], bound: null, dirty: false }),
    }),
    {
      name: 'ilvl:active',
      // Persist data only — actions are re-supplied by the initializer on rehydrate.
      partialize: (s) => ({
        base: s.base,
        edits: s.edits,
        bound: s.bound,
        dirty: s.dirty,
        lastUnboundBase: s.lastUnboundBase,
      }),
    },
  ),
)
