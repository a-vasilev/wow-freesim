import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The set of available themes. Day one ships a single neutral placeholder; the
 * switching mechanism is built now so adding a theme later is purely a new
 * [data-theme] block in semantic.css plus an entry here.
 */
export const THEMES = ['neutral'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'neutral'

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
    { name: 'wow-freesim:theme' },
  ),
)
