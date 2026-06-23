/// <reference lib="webworker" />
/**
 * The wasm engine worker — the ONLY place in the app that touches the simc-wasm
 * artifact. Hosts the v1205.01 ES6 glue (`createSimc`), drives it CLI-style via
 * MEMFS (`json2=/out.json`), and exposes a Comlink API to the main thread.
 *
 * Consumption contract: WEB_UI_PLAN §3.1.
 *
 * Runtime notes (validate in-browser via the /dev/engine route):
 *  - `callMain` runs simc synchronously on THIS worker (proven under Node: it
 *    returns only when out.json is written). It therefore BLOCKS the worker for
 *    the run — which is why cancel() is a worker.terminate() from the main-thread
 *    wrapper, not a message this worker could process mid-run.
 *  - Progress still streams: simc prints a `\r` progressbar to stdout during the
 *    run; our `print` handler parses it and posts via the (proxied) onProgress
 *    callback, which delivers to the main thread even while we're blocked.
 *  - We create a FRESH module per call so each sim starts from clean global state
 *    (simc is built to run main once per process). The 107 MB wasm BYTES are
 *    cached (Cache API) so only compile — never re-download — repeats. Caching the
 *    compiled WebAssembly.Module to skip recompile is a later optimization.
 */
import * as Comlink from 'comlink'
import { ENGINE_CONFIG } from './config'
import { parseCharacter, parseSimReport } from './json2'
import {
  type EngineInfo,
  type ParsedCharacter,
  type Progress,
  type SimInput,
  type SimReport,
} from './schemas'

// Emscripten module surface we rely on (narrowed; the glue exposes much more).
interface SimcModule {
  FS: {
    writeFile(path: string, data: string): void
    readFile(path: string, opts: { encoding: 'utf8' }): string
    unlink(path: string): void
    analyzePath(path: string): { exists: boolean }
  }
  callMain(args: string[]): number
}
type CreateSimc = (moduleArg: Record<string, unknown>) => Promise<SimcModule>

const PROFILE_PATH = '/profile.simc'
const OUT_PATH = '/out.json'

// The glue bakes PTHREAD_POOL_SIZE=8 (pre-allocated em-pthread workers). simc's
// main() runs synchronously on THIS worker via callMain, which blocks our event
// loop — so pthreads BEYOND the pre-warmed pool can't be spawned/joined on demand
// (that needs a free host event loop) and the run deadlocks after merging. Capping
// the sim's `threads=` to the pool size keeps every worker pre-allocated → no
// on-demand spawn → no deadlock. (Raising this needs a larger pool baked into the
// engine build, or running main off the host thread.)
const ENGINE_POOL_SIZE = 8

let createSimc: CreateSimc | null = null
let wasmBytes: ArrayBuffer | null = null

// Each worker hosts ONE module and runs ONE sim. simc cannot re-run main() in
// the same instance (a 2nd callMain traps the wasm), so reuse is impossible — the
// main-thread wrapper (WasmEngine) spawns a fresh worker per call and terminates
// it after (which also disposes the pthread pool cleanly). Module instantiation
// is ~200ms, so this is affordable. currentOnProgress routes the print handler to
// the active call.
let moduleInstance: SimcModule | null = null
let currentOnProgress: ((p: Partial<Progress>) => void) | null = null
let stderrTail: string[] = []

/** Logical cores the host reports. */
const hwCores = (): number => Math.max(1, self.navigator?.hardwareConcurrency || 1)

/** Threads the sim may actually use — capped to the baked pthread pool. */
const simThreads = (): number => Math.min(ENGINE_POOL_SIZE, hwCores())

// ── artifact loading (cached) ────────────────────────────────────────────────

async function loadGlue(): Promise<CreateSimc> {
  if (createSimc) return createSimc
  // Same-origin absolute URL; @vite-ignore so Vite leaves the 107 MB sibling
  // wasm + the glue out of its dependency graph.
  const mod = (await import(/* @vite-ignore */ ENGINE_CONFIG.glueUrl)) as {
    default: CreateSimc
  }
  createSimc = mod.default
  return createSimc
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function loadWasmBytes(): Promise<ArrayBuffer> {
  if (wasmBytes) return wasmBytes
  const url = ENGINE_CONFIG.wasmUrl
  // Cache API keyed by the immutable versioned URL, so a patch bump invalidates.
  let bytes: ArrayBuffer | undefined
  try {
    const cache = await caches.open('simc-engine')
    const hit = await cache.match(url)
    if (hit) bytes = await hit.arrayBuffer()
    else {
      // Explicit CORS fetch (works same-origin in dev; required for the R2 wasm
      // under COEP: credentialless in prod — see WEB_UI_PLAN §3.1).
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`wasm fetch ${res.status}`)
      await cache.put(url, res.clone())
      bytes = await res.arrayBuffer()
    }
  } catch {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`wasm fetch failed: ${res.status} ${url}`)
    bytes = await res.arrayBuffer()
  }
  if (ENGINE_CONFIG.verifyIntegrity) {
    const got = await sha256Hex(bytes)
    if (got !== ENGINE_CONFIG.sha256.wasm) {
      throw new Error(
        `simc.wasm integrity mismatch (got ${got.slice(0, 12)}…, ` +
          `want ${ENGINE_CONFIG.sha256.wasm.slice(0, 12)}…)`,
      )
    }
  }
  wasmBytes = bytes
  return bytes
}

// ── progress parsing (simc stdout progressbar) ───────────────────────────────

// Matches the last "…] <done>/<total>" in a (possibly \r-concatenated) chunk,
// e.g. "Generating Baseline: 1/1 [====>...] 43/50 28.058".
const BAR_RE = /\]\s+(\d+)\/(\d+)/g

function progressFromChunk(chunk: string): Partial<Progress> | null {
  if (/Merging data/.test(chunk)) return { phase: 'merging', pct: 0.97 }
  if (/Analyzing actor|Generating reports/.test(chunk))
    return { phase: 'merging', pct: 0.99 }
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  BAR_RE.lastIndex = 0
  while ((m = BAR_RE.exec(chunk)) !== null) last = m
  if (!last) return null
  const done = Number(last[1])
  const total = Number(last[2])
  if (!total) return null
  return {
    phase: 'running',
    pct: Math.min(0.96, done / total),
    iterations: done,
    totalIterations: total,
  }
}

// ── one simulation pass ──────────────────────────────────────────────────────

function buildArgs(input: SimInput, inspectOnly: boolean): string[] {
  const o = input.options
  const args = [PROFILE_PATH]
  if (inspectOnly) {
    args.push('iterations=1', 'threads=1', 'target_error=0')
  } else {
    args.push(
      `fight_style=${o.fightStyle}`,
      `desired_targets=${o.targets}`,
      `max_time=${o.fightLength}`,
      `threads=${simThreads()}`,
    )
    if (o.iterations) args.push(`iterations=${o.iterations}`, 'target_error=0')
    else if (o.targetError) args.push(`target_error=${o.targetError}`)
  }
  args.push(`json2=${OUT_PATH}`)
  return args
}

async function getModule(): Promise<SimcModule> {
  if (moduleInstance) return moduleInstance
  const create = await loadGlue()
  const binary = await loadWasmBytes()
  console.log('[engine] instantiating module… (cores', self.navigator?.hardwareConcurrency, 'isolated', self.crossOriginIsolated, ')')
  const t0 = performance.now()
  moduleInstance = await create({
    noInitialRun: true,
    wasmBinary: binary,
    print: (line: string) => {
      console.log('[simc]', line)
      const p = progressFromChunk(line)
      if (p) currentOnProgress?.(p)
    },
    printErr: (line: string) => {
      console.warn('[simc:err]', line)
      stderrTail.push(line)
      if (stderrTail.length > 40) stderrTail.shift()
      const p = progressFromChunk(line)
      if (p) currentOnProgress?.(p)
    },
    onAbort: (reason: unknown) => console.error('[engine] onAbort', reason),
  })
  console.log(`[engine] module ready in ${Math.round(performance.now() - t0)}ms`)
  return moduleInstance
}

/** Run callMain once; returns out.json text or null. The profile is written to
 *  MEMFS by the caller first. NOTE: each worker runs exactly ONE sim — simc
 *  cannot re-run main() in-process (a 2nd callMain traps the wasm: "table index
 *  out of bounds" / "null function"), so the main-thread wrapper spawns a fresh
 *  worker (→ fresh module) per call and terminates it after. */
function runOnce(module: SimcModule, args: string[]): string | null {
  if (module.FS.analyzePath(OUT_PATH).exists) module.FS.unlink(OUT_PATH)
  console.log('[engine] callMain', args)
  const t0 = performance.now()
  let code: number | undefined
  try {
    code = module.callMain(args)
  } catch (e) {
    // ExitStatus / "unwind" are normal exit signals under some paths.
    if (!(e instanceof Error) || !/ExitStatus|unwind/.test(e.message)) {
      console.error('[engine] callMain threw', e)
      stderrTail.push(String(e))
    }
  }
  const exists = module.FS.analyzePath(OUT_PATH).exists
  console.log(
    `[engine] callMain returned ${code} in ${Math.round(performance.now() - t0)}ms · out.json exists=${exists}`,
  )
  return exists ? module.FS.readFile(OUT_PATH, { encoding: 'utf8' }) : null
}

async function simulate(
  input: SimInput,
  inspectOnly: boolean,
  onProgress?: (p: Partial<Progress>) => void,
): Promise<unknown> {
  onProgress?.({ phase: 'init', pct: 0 })
  currentOnProgress = onProgress ?? null
  stderrTail = []
  try {
    const module = await getModule()
    module.FS.writeFile(PROFILE_PATH, input.profile)
    const json = runOnce(module, buildArgs(input, inspectOnly))
    if (json === null) {
      throw new Error(
        'simc produced no report.' +
          (stderrTail.length ? `\n${stderrTail.slice(-12).join('\n')}` : ''),
      )
    }
    onProgress?.({ phase: 'done', pct: 1 })
    return JSON.parse(json)
  } finally {
    currentOnProgress = null
  }
}

// ── exposed API ──────────────────────────────────────────────────────────────

const api = {
  async init(): Promise<EngineInfo> {
    await loadGlue()
    await loadWasmBytes() // prove the artifact is reachable + (optionally) intact
    return {
      implementation: 'wasm',
      version: ENGINE_CONFIG.scVersion,
      crossOriginIsolated: self.crossOriginIsolated === true,
      cores: self.navigator?.hardwareConcurrency || 0,
      threads: simThreads(),
    }
  },

  async inspect(input: SimInput): Promise<ParsedCharacter> {
    const raw = await simulate(input, true)
    return parseCharacter(raw)
  },

  async run(
    input: SimInput,
    onProgress: (p: Partial<Progress>) => void,
  ): Promise<SimReport> {
    const raw = await simulate(input, false, onProgress)
    return parseSimReport(raw)
  },
}

export type WasmWorkerApi = typeof api
Comlink.expose(api)
