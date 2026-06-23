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

interface QuickSimState {
  phase: QuickSimPhase
  profile: string
  options: SimOptions
  character: ParsedCharacter | null
  report: SimReport | null
  progress: Progress | null
  error: string | null

  setProfile: (profile: string) => void
  setOptions: (options: SimOptions) => void
  inspect: () => Promise<void>
  run: () => Promise<void>
  cancel: () => void
  editProfile: () => void
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
  profile: '',
  options: DEFAULT_SIM_OPTIONS,
  character: null,
  report: null,
  progress: null,
  error: null,

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
    const { profile, options } = get()
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
