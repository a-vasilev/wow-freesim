import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'

/**
 * Surfaces a clear, themed banner when the page is NOT cross-origin isolated, so
 * the failure mode (no SharedArrayBuffer -> no threads -> unusable sims) is
 * obvious rather than silent. Renders nothing when isolation is active.
 */
export function CrossOriginIsolationBanner() {
  if (isCrossOriginIsolated()) return null

  return (
    <div role="alert" className="bg-danger text-danger-fg">
      <p className="mx-auto max-w-6xl px-6 py-3 text-sm">
        <strong className="font-semibold">
          Cross-origin isolation is off.
        </strong>{' '}
        Multithreaded WASM needs{' '}
        <code className="font-mono">SharedArrayBuffer</code>, which requires
        COOP/COEP headers. Sims will be unavailable or single-threaded. (
        {hardwareConcurrency()} logical cores detected.)
      </p>
    </div>
  )
}
