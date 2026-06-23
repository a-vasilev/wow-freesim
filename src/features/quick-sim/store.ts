import { create } from 'zustand'
import {
  DEFAULT_SIM_OPTIONS,
  EngineCancelledError,
  getEngine,
  type ParsedCharacter,
  type Progress,
  type SimOptions,
  type SimReport,
} from '@/engine'

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

interface QuickSimState {
  phase: QuickSimPhase
  mode: QuickSimMode
  profile: string
  options: SimOptions
  character: ParsedCharacter | null
  report: SimReport | null
  progress: Progress | null
  error: string | null

  setMode: (mode: QuickSimMode) => void
  setProfile: (profile: string) => void
  setOptions: (options: SimOptions) => void
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

/** Heuristic: does this text look like a simc profile worth inspecting? */
export function looksLikeProfile(text: string): boolean {
  return /^\s*(death_?knight|demon_?hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)\s*=/im.test(
    text,
  )
}

export const useQuickSim = create<QuickSimState>((set, get) => ({
  phase: 'empty',
  mode: 'compose',
  profile: '',
  options: DEFAULT_SIM_OPTIONS,
  character: null,
  report: null,
  progress: null,
  error: null,

  setMode: (mode) => set({ mode }),
  setProfile: (profile) => set({ profile }),
  setOptions: (options) => set({ options }),

  inspect: async () => {
    const { profile } = get()
    if (!looksLikeProfile(profile)) return
    set({ phase: 'inspecting', error: null })
    try {
      const character = await getEngine().inspect({
        profile,
        options: get().options,
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
    const { profile, options, phase } = get()
    // Don't launch a second worker over an in-flight run (would orphan the first).
    if (phase === 'running') return
    // Guard an empty/whitespace profile here so we surface a clear message instead
    // of booting the engine to write an empty .simc that simc rejects opaquely.
    if (!profile.trim()) {
      set({
        phase: 'error',
        error: 'No profile to simulate — paste a /simc string first.',
      })
      return
    }
    set({ phase: 'running', error: null, report: null, progress: null })
    try {
      const report = await getEngine().run({ profile, options }, (progress) =>
        set({ progress }),
      )
      set({ report, phase: 'report' })
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

  loadRun: ({ profile, options, report }) =>
    set({
      phase: 'report',
      mode: 'compose',
      profile,
      options,
      report,
      character: null,
      progress: null,
      error: null,
    }),

  reset: () =>
    set({
      phase: 'empty',
      profile: '',
      character: null,
      report: null,
      progress: null,
      error: null,
    }),
}))

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
