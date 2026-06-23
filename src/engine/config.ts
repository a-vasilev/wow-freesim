/**
 * Engine artifact pin + integrity record. Bumping the engine is a change HERE
 * (tag + hashes), decoupled from app redeploys — `data patch == engine patch`
 * (OVERALL_PLAN §4). Values mirror the release `manifest.json` for v1205.01.
 *
 * Hosting (WEB_UI_PLAN §3.1):
 *  - `simc.js` MUST be same-origin (pthread workers re-load it as `em-pthread`).
 *  - `simc.wasm` (107 MB) may be remote (fetched once, shared to pthreads).
 * In dev both are served same-origin from `.engine-cache/` by a Vite middleware
 * (see vite.config.ts). In prod, point `wasmBaseUrl` at the R2 custom domain.
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

const TAG = 'v1205.01'

/**
 * The pthread pool size baked into the engine glue (PTHREAD_POOL_SIZE=8). The sim
 * caps `threads=` to this so every worker is pre-allocated — see the deadlock note
 * in wasm-worker.ts. Surfaced here so the UI can show a thread/core line without
 * booting the 107 MB binary. Raising it requires a larger pool in the engine build.
 */
export const ENGINE_THREAD_POOL = 8

/** Threads the sim will actually use on this host (capped to the pool). */
export function engineThreadCount(cores: number): number {
  return Math.min(ENGINE_THREAD_POOL, Math.max(1, cores))
}

// Dev/default: same-origin paths served from .engine-cache by the Vite middleware.
// `VITE_ENGINE_WASM_URL` overrides the wasm origin (e.g. the R2 custom domain).
const wasmOverride = import.meta.env?.VITE_ENGINE_WASM_URL as string | undefined

export const ENGINE_CONFIG: EngineConfig = {
  tag: TAG,
  scVersion: '1205-01',
  glueUrl: `/engine/${TAG}/simc.js`,
  wasmUrl: wasmOverride ?? `/engine/${TAG}/simc.wasm`,
  sha256: {
    glue: 'd53c56ec678d0bfdd9c564e9cdaa3f354262e1ae204d7b009ce632e799527543',
    wasm: '22329ac81009d0da191cd177925f15adf7baf27b854154de75923862179e7a55',
  },
  // Hashing 107 MB on every boot is wasteful in dev; gate it on prod by default.
  verifyIntegrity: import.meta.env?.PROD ?? false,
}
