/**
 * Engine artifact pin + integrity record. Bumping the engine is a change HERE
 * (tag + hashes), decoupled from app redeploys — `data patch == engine patch`
 * (OVERALL_PLAN §4). Values mirror the release `manifest.json` for v1205.01.
 *
 * Hosting (WEB_UI_PLAN §3.1):
 *  - `simc.js` MUST be same-origin (pthread workers re-load it as `em-pthread`).
 *  - `simc.wasm` (107 MB) may be remote (fetched once, shared to pthreads).
 * In dev both are served same-origin from `.engine-cache/` by a Vite middleware
 * (see vite.config.ts). In prod, set `VITE_ENGINE_WASM_URL` to the R2 custom-domain
 * origin (tag-agnostic — the `/<tag>/simc.wasm` path is appended below).
 */
export interface EngineConfig {
  tag: string
  /** simc version label surfaced in EngineInfo. */
  scVersion: string
  /** Same-origin URL of the ES6 glue (must stay same-origin). */
  glueUrl: string
  /** URL of the 107 MB binary (same-origin in dev; R2 in prod). */
  wasmUrl: string
  /** sha256 (hex) of each file from manifest.json, for integrity verification. */
  sha256: { glue: string; wasm: string }
  /** Verify the wasm bytes against sha256 before instantiating. */
  verifyIntegrity: boolean
}

const TAG = 'v1205.01-2'

/**
 * Threads the sim should use on this host: the user's chosen count clamped to
 * [1, cores], defaulting to ALL logical cores when unset. simc requires `threads=`
 * to be ≤ the host's hardware concurrency (the engine pre-allocates its pthread
 * pool to that), so `cores` is a hard ceiling. Surfaced here so the UI can show a
 * thread/core line without booting the 107 MB binary.
 */
export function engineThreadCount(cores: number, chosen?: number | null): number {
  const max = Math.max(1, cores)
  if (chosen == null) return max
  return Math.min(max, Math.max(1, Math.floor(chosen)))
}

// Dev/default: same-origin paths served from .engine-cache by the Vite middleware.
// `VITE_ENGINE_WASM_URL` points at the R2 custom-domain ORIGIN (e.g.
// `https://engine.yourdomain.com`); the per-tag path `/${TAG}/simc.wasm` is appended
// here. Keeping the env var tag-agnostic means it's set ONCE and never touched again
// across engine bumps — bumping is then a pure repo change (Strategy A, hands-off).
// A full tagged URL (…/<tag>/simc.wasm) is still honored for backward compatibility.
const wasmBase = (import.meta.env?.VITE_ENGINE_WASM_URL as string | undefined)?.replace(/\/+$/, '')
const wasmUrl = wasmBase
  ? wasmBase.endsWith('.wasm')
    ? wasmBase
    : `${wasmBase}/${TAG}/simc.wasm`
  : `/engine/${TAG}/simc.wasm`

export const ENGINE_CONFIG: EngineConfig = {
  tag: TAG,
  scVersion: '1205-01-2',
  glueUrl: `/engine/${TAG}/simc.js`,
  wasmUrl,
  sha256: {
    glue: 'b075936d5e290729825c44f56e611266f5c6a50a71c299a362c3033d97e0cd0c',
    wasm: '801c9a95aabf363f49ae1d3f5c8189ebcd220957af0b4ef08d27b5a010667dc1',
  },
  // Hashing 107 MB on every boot is wasteful in dev; gate it on prod by default.
  verifyIntegrity: import.meta.env?.PROD ?? false,
}
