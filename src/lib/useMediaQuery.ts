import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. SSR-safe (returns `false` on the server) and
 * updates on viewport changes via `matchMedia`. Used for responsive behaviour
 * that needs to be in JS (e.g. forcing the sidebar to its icon-rail on narrow
 * viewports) rather than pure CSS.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
