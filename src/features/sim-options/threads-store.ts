import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SimOptions } from '@/engine'

/**
 * The user's CPU-thread preference for the engine. It's a machine/performance
 * setting (it doesn't change the DPS result), so it lives OUTSIDE the per-sim
 * `SimOptions` state and is persisted on its own — the choice survives reloads.
 *
 * `threads === null` means "auto": use every logical core the host reports. We
 * store null rather than the resolved number so "max" keeps tracking the hardware
 * if the user later opens the app on a machine with a different core count. An
 * explicit number is clamped to [1, hardwareConcurrency] at the engine boundary.
 */
interface ThreadPrefState {
  threads: number | null
  setThreads: (threads: number | null) => void
}

export const useThreadPref = create<ThreadPrefState>()(
  persist(
    (set) => ({
      threads: null,
      setThreads: (threads) => set({ threads }),
    }),
    { name: 'ilvl:threads' },
  ),
)

/** Attach the persisted thread choice to sim options, just before an engine call.
 *  Auto (null) leaves `threads` unset so the engine defaults to all cores. */
export function withThreadPref(options: SimOptions): SimOptions {
  const threads = useThreadPref.getState().threads
  return threads == null ? options : { ...options, threads }
}
