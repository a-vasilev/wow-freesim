import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Sidebar collapse preference. A pure UI/layout choice, persisted on its own so it
 * survives reloads (mirrors the thread-pref pattern). Narrow viewports force the
 * icon-rail regardless of this — see Sidebar (`useMediaQuery`).
 */
interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggle: () => set({ collapsed: !get().collapsed }),
    }),
    { name: 'ilvl:sidebar' },
  ),
)
