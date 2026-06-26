import { create } from 'zustand'
import {
  EngineCancelledError,
  getEngine,
  type ParsedCharacter,
  type Progress,
  type SimOptions,
  type SimReport,
} from '@/engine'
import { looksLikeProfile } from '@/lib/simcProfile'
import { withThreadPref } from '@/features/sim-options/threads-store'
import { useSimOptions } from '@/features/sim-options/simOptionsStore'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { buildProfileFromDraft } from '@/features/characters/buildProfile'

/** Run-state machine for Quick Sim (WEB_UI_PLAN §6). */
export type QuickSimPhase =
  | 'empty'
  | 'inspecting'
  | 'ready'
  | 'running'
  | 'report'
  | 'error'

/** Compose (paste box + parsed preview) vs Advanced (raw `.simc` editor). Both
 *  feed the same inspect()/run() path; it's a view toggle, not a separate route. */
export type QuickSimMode = 'compose' | 'advanced'

/**
 * Tab-local run state ONLY. The working profile and fight settings now live in the
 * shared stores (`useActiveDraft` + `useSimOptions`, CHARACTER_PERSISTENCE §5.2),
 * so a paste here flows to Top Gear for free. Everything below — phase, mode,
 * parsed preview, report, progress — stays per-tab and must not bleed across tabs.
 */
interface QuickSimState {
  phase: QuickSimPhase
  mode: QuickSimMode
  character: ParsedCharacter | null
  report: SimReport | null
  progress: Progress | null
  error: string | null
  /** The exact profile + options that produced `report` (for save-to-history). */
  source: { profile: string; options: SimOptions } | null

  setMode: (mode: QuickSimMode) => void
  inspect: () => Promise<void>
  run: () => Promise<void>
  cancel: () => void
  editProfile: () => void
  /** Load a persisted run (from history) into a viewable report state. */
  loadRun: (input: {
    profile: string
    options: SimOptions
    report: SimReport
  }) => void
  reset: () => void
}

// Re-export for existing importers; the implementation now lives in lib.
export { looksLikeProfile }

/** The shared working profile, composed through the `buildProfile` seam (§5.3). */
function currentProfile(): string {
  return buildProfileFromDraft(useActiveDraft.getState())
}

function currentOptions(): SimOptions {
  return useSimOptions.getState().options
}

export const useQuickSim = create<QuickSimState>((set, get) => ({
  phase: 'empty',
  mode: 'compose',
  character: null,
  report: null,
  progress: null,
  error: null,
  source: null,

  setMode: (mode) => set({ mode }),

  inspect: async () => {
    const profile = currentProfile()
    if (!looksLikeProfile(profile)) return
    set({ phase: 'inspecting', error: null })
    try {
      const character = await getEngine().inspect({
        profile,
        options: currentOptions(),
      })
      set({ character, phase: 'ready' })
    } catch (e) {
      set({
        phase: get().character ? 'ready' : 'empty',
        error: messageOf(e),
      })
    }
  },

  run: async () => {
    const { phase } = get()
    // Don't launch a second worker over an in-flight run (would orphan the first).
    if (phase === 'running') return
    const profile = currentProfile()
    const options = currentOptions()
    // Guard an empty/whitespace profile here so we surface a clear message instead
    // of booting the engine to write an empty .simc that simc rejects opaquely.
    if (!profile.trim()) {
      set({
        phase: 'error',
        error: 'No profile to simulate — paste a /simc string first.',
      })
      return
    }
    set({ phase: 'running', error: null, report: null, progress: null, source: null })
    try {
      const report = await getEngine().run(
        { profile, options: withThreadPref(options) },
        (progress) => set({ progress }),
      )
      set({ report, phase: 'report', source: { profile, options } })
    } catch (e) {
      if (e instanceof EngineCancelledError) {
        set({ phase: get().character ? 'ready' : 'empty', progress: null })
      } else {
        set({ phase: 'error', error: messageOf(e) })
      }
    }
  },

  cancel: () => getEngine().cancel(),

  editProfile: () => set({ phase: get().character ? 'ready' : 'empty' }),

  loadRun: ({ profile, options, report }) => {
    // A historical run becomes the shared working profile (one-draft model, §2.1),
    // unbound — it's a snapshot, not tied to a saved loadout.
    useActiveDraft.setState({ base: profile, edits: [], bound: null, dirty: false })
    useSimOptions.getState().setOptions(options)
    set({
      phase: 'report',
      mode: 'compose',
      report,
      character: null,
      progress: null,
      error: null,
      source: { profile, options },
    })
  },

  // Tab-local reset only — the shared draft (the working profile) is left intact;
  // clearing it is an explicit user action elsewhere, not a side effect of a tab.
  reset: () =>
    set({
      phase: 'empty',
      character: null,
      report: null,
      progress: null,
      error: null,
      source: null,
    }),
}))

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
