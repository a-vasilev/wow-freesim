import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from './theme-store'

/**
 * Applies the active theme by setting `data-theme` on <html>. The attribute is
 * what every semantic token resolves against (see semantic.css). Persistence is
 * handled by the store; this just keeps the DOM attribute in sync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return children
}
