/**
 * Cross-origin isolation guard helpers. Multithreaded WASM needs
 * SharedArrayBuffer, which the browser only exposes when the document is
 * cross-origin isolated (COOP/COEP headers — set via Vite dev headers and
 * Cloudflare `_headers` in prod). See docs/OVERALL_PLAN.md §1.
 */

export function isCrossOriginIsolated(): boolean {
  return typeof window !== 'undefined' && window.crossOriginIsolated === true
}

/** Logical core count the worker pool would size to (1 if unknown). */
export function hardwareConcurrency(): number {
  if (typeof navigator === 'undefined') return 1
  return navigator.hardwareConcurrency || 1
}
