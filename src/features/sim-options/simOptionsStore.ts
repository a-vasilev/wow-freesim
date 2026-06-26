import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SIM_OPTIONS, type SimOptions } from '@/engine'

/**
 * The global default fight settings (CHARACTER_PERSISTENCE §2.4 / §5.1) — one
 * remembered `SimOptions` set, shared by every sim tab and persisted across
 * sessions (localStorage `ilvl:sim-options`, same pattern as the threads store).
 * A change here becomes the new default; a run can still override per-run.
 *
 * `threads` keeps its own store (sim-options/threads-store) — it's a machine/perf
 * preference, attached at the engine boundary, not a sim parameter.
 */
interface SimOptionsState {
  options: SimOptions
  setOptions: (options: SimOptions) => void
}

export const useSimOptions = create<SimOptionsState>()(
  persist(
    (set) => ({
      options: DEFAULT_SIM_OPTIONS,
      setOptions: (options) => set({ options }),
    }),
    {
      name: 'ilvl:sim-options',
      partialize: (s) => ({ options: s.options }),
    },
  ),
)
