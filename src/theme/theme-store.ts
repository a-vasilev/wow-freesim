import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The set of available themes. Day one ships "noir" ("Editorial Noir", the
 * approved design — see docs/DESIGN_SYSTEM.md). The switching mechanism is built
 * now so adding a theme later is purely a new [data-theme] block in semantic.css
 * plus an entry here.
 */
export const THEMES = ['noir'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'noir'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ilvl:theme' },
  ),
)
