/**
 * Engine factory + env flag. `VITE_SIM_ENGINE` selects the implementation;
 * switching is a one-line/config change and all UI built against the `SimEngine`
 * seam keeps working. The real wasm engine is the default — there is no
 * hand-authored mock (data fidelity comes from real captures; see
 * src/engine/fixtures/). A future fixture-replay engine can slot in here behind
 * the same seam without touching callers.
 */
import type { SimEngine } from './SimEngine'
import { WasmEngine } from './WasmEngine'

export type EngineKind = 'wasm'

export function resolveEngineKind(): EngineKind {
  const flag = import.meta.env?.VITE_SIM_ENGINE as string | undefined
  switch (flag) {
    case 'wasm':
    default:
      return 'wasm'
  }
}

let singleton: SimEngine | null = null

/** The process-wide engine instance (one wasm worker is plenty). */
export function getEngine(): SimEngine {
  if (!singleton) singleton = createEngine(resolveEngineKind())
  return singleton
}

export function createEngine(kind: EngineKind = resolveEngineKind()): SimEngine {
  switch (kind) {
    case 'wasm':
      return new WasmEngine()
  }
}
