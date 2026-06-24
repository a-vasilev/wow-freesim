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
import { ENGINE_CONFIG, engineThreadCount } from './config'
import { parseCharacter, parseProfilesetReport, parseSimReport } from './json2'
import {
  type EngineInfo,
  type ParsedCharacter,
  type ProfilesetInput,
  type ProfilesetReport,
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

// Dev-gated logging: the per-line `[simc]`/`[engine]` trace is invaluable while
// developing the engine path but pure noise in production. `import.meta.env.DEV`
// is statically replaced, so these calls (and their string-building) are dropped
// from the prod bundle. Genuine failures still surface via thrown Errors (with the
// captured stderr tail) and the kept console.error calls below.
const DEBUG = import.meta.env?.DEV ?? false
const dlog = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args)
}
const dwarn = (...args: unknown[]): void => {
  if (DEBUG) console.warn(...args)
}

const PROFILE_PATH = '/profile.simc'
const OUT_PATH = '/out.json'

// simc's `threads=` is now caller-controlled: the engine sizes its pthread pool to
// the host's hardware concurrency, so any value up to navigator.hardwareConcurrency
// is safe (no pre-warmed-pool deadlock). The UI persists the user's choice and
// attaches it to SimOptions; here we just clamp it to the host's core count.

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
const hwCores = (): number =>
  Math.max(1, self.navigator?.hardwareConcurrency || 1)

/** Threads the sim may use — the requested count clamped to the host's cores
 *  (undefined ⇒ all cores). */
const simThreads = (chosen?: number): number => engineThreadCount(hwCores(), chosen)

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

/** sha256 of the bytes, or null when integrity verification is off (dev). */
async function wasmHash(bytes: ArrayBuffer): Promise<string | null> {
  return ENGINE_CONFIG.verifyIntegrity ? await sha256Hex(bytes) : null
}

/** True if these bytes are the pinned wasm (always true when verification is off). */
const wasmOk = (hash: string | null): boolean =>
  !ENGINE_CONFIG.verifyIntegrity || hash === ENGINE_CONFIG.sha256.wasm

/** CORS fetch of the wasm with an explicit HTTP-cache mode; returns bytes + hash.
 *  CORS is required for the R2 wasm under COEP: credentialless (WEB_UI_PLAN §3.1);
 *  same-origin in dev. */
async function fetchWasm(
  mode: RequestCache,
): Promise<{ bytes: ArrayBuffer; hash: string | null }> {
  const res = await fetch(ENGINE_CONFIG.wasmUrl, { mode: 'cors', cache: mode })
  if (!res.ok)
    throw new Error(`wasm fetch failed: ${res.status} ${ENGINE_CONFIG.wasmUrl}`)
  const bytes = await res.arrayBuffer()
  return { bytes, hash: await wasmHash(bytes) }
}

// Self-healing load: the wasm is pinned by an immutable versioned URL, so both the
// Cache API entry and the browser HTTP-cache entry are cached aggressively and never
// re-validated. That means a single bad copy (a partial/wrong upload fetched during
// setup, a truncated download) would otherwise brick the engine on EVERY reload until
// the user manually clears storage. So at each layer we verify and, on mismatch, drop
// to the next source — Cache API → HTTP cache → network (cache: 'reload' bypasses a
// poisoned immutable HTTP-cache entry, which a normal fetch/reload won't).
async function loadWasmBytes(): Promise<ArrayBuffer> {
  if (wasmBytes) return wasmBytes
  const url = ENGINE_CONFIG.wasmUrl
  const cache = await caches.open('simc-engine').catch(() => null)

  // 1. Cache API copy — verify; evict if stale/corrupt.
  if (cache) {
    const hit = await cache.match(url)
    if (hit) {
      const bytes = await hit.arrayBuffer()
      if (wasmOk(await wasmHash(bytes))) return (wasmBytes = bytes)
      console.warn('[engine] cached wasm failed integrity — evicting')
      await cache.delete(url)
    }
  }

  // 2. Network: try the HTTP cache first, then force-bypass it on mismatch.
  let got: string | null = null
  for (const mode of ['default', 'reload'] as const) {
    const { bytes, hash } = await fetchWasm(mode)
    if (wasmOk(hash)) {
      if (cache)
        await cache.put(
          url,
          new Response(bytes, {
            headers: { 'Content-Type': 'application/wasm' },
          }),
        )
      return (wasmBytes = bytes)
    }
    got = hash
    console.warn(
      `[engine] wasm failed integrity (http-cache:${mode}) got ${hash?.slice(0, 12)}…`,
    )
  }

  throw new Error(
    `simc.wasm integrity mismatch (got ${got?.slice(0, 12)}…, ` +
      `want ${ENGINE_CONFIG.sha256.wasm.slice(0, 12)}…)`,
  )
}

// ── progress parsing (simc stdout progressbar) ───────────────────────────────

// simc renders one progress frame per phase as it works, e.g.
//   "Generating Baseline: 1/1 [====>...] 43/50 28.058"
//   "Generating Profileset: Foo 2/4 [===>] 100/100 30msec"
// The "<phaseIdx>/<phaseTotal>" BEFORE the "[bar]" is the phase/set counter; the
// "<iterDone>/<iterTotal>" AFTER it is the inner iteration counter for the CURRENT
// phase. Frames arrive \r-concatenated, so we take the last complete frame.
const FRAME_RE = /(\d+)\/(\d+)\s*\[[^\]]*\]\s*(\d+)\/(\d+)/g

// How many sets the active run spans: 1 for a plain sim, baseline + N profilesets
// for a Top Gear batch. Set per-call in simulate(); lets us drive overall progress
// from the SET counter (which advances monotonically) instead of the inner
// iteration counter (which just cycles 0→100% within every set, and under
// target_error only ever reports its final "N/N" frame — hence the old 96%-peg).
let currentTotalSets = 1

function progressFromChunk(chunk: string): Partial<Progress> | null {
  if (/Merging data/.test(chunk)) return { phase: 'merging', pct: 0.97 }
  if (/Analyzing actor|Generating reports/.test(chunk))
    return { phase: 'merging', pct: 0.99 }
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  FRAME_RE.lastIndex = 0
  while ((m = FRAME_RE.exec(chunk)) !== null) last = m
  if (!last) return null
  const setIdx = Number(last[1]) // 1 = baseline; 2..N+1 = profilesets
  const iterDone = Number(last[3])
  const iterTotal = Number(last[4])
  if (!iterTotal) return null
  const iterFrac = Math.min(1, iterDone / iterTotal)

  if (currentTotalSets > 1) {
    // Top Gear batch: completed sets + the current set's inner fraction. simc
    // reports the baseline phase as "1/1", so we use the set count we passed in,
    // not the phaseTotal simc prints. (Under target_error iterFrac is 1 — each set
    // emits only its completion frame — so this advances one notch per set.)
    const pct = Math.min(0.96, (setIdx - 1 + iterFrac) / currentTotalSets)
    return {
      phase: 'running',
      pct,
      // Report PROFILESETS done (baseline excluded) to match the "N sets" headline.
      iterations: Math.max(0, setIdx - 1),
      totalIterations: currentTotalSets - 1,
    }
  }
  // Plain sim: the inner iteration counter is the real progress.
  return {
    phase: 'running',
    pct: Math.min(0.96, iterFrac),
    iterations: iterDone,
    totalIterations: iterTotal,
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
      `threads=${simThreads(o.threads)}`,
    )
    if (o.iterations) args.push(`iterations=${o.iterations}`, 'target_error=0')
    else if (o.targetError) args.push(`target_error=${o.targetError}`)
  }
  args.push(`json2=${OUT_PATH}`)
  return args
}

/** Append `profileset."name"+="override"` lines to the base profile (Top Gear).
 *  One line per override fragment; simc runs base + every set as one batch. */
function buildProfilesetProfile(input: ProfilesetInput): string {
  const lines = [input.profile.trimEnd(), '']
  for (const ps of input.profilesets) {
    for (const ov of ps.overrides) {
      lines.push(`profileset."${ps.name}"+="${ov}"`)
    }
  }
  return lines.join('\n') + '\n'
}

async function getModule(): Promise<SimcModule> {
  if (moduleInstance) return moduleInstance
  const create = await loadGlue()
  const binary = await loadWasmBytes()
  dlog(
    '[engine] instantiating module… (cores',
    self.navigator?.hardwareConcurrency,
    'isolated',
    self.crossOriginIsolated,
    ')',
  )
  const t0 = performance.now()
  moduleInstance = await create({
    noInitialRun: true,
    wasmBinary: binary,
    print: (line: string) => {
      dlog('[simc]', line)
      const p = progressFromChunk(line)
      if (p) currentOnProgress?.(p)
    },
    printErr: (line: string) => {
      dwarn('[simc:err]', line)
      stderrTail.push(line)
      if (stderrTail.length > 40) stderrTail.shift()
      const p = progressFromChunk(line)
      if (p) currentOnProgress?.(p)
    },
    onAbort: (reason: unknown) => console.error('[engine] onAbort', reason),
  })
  dlog(`[engine] module ready in ${Math.round(performance.now() - t0)}ms`)
  return moduleInstance
}

/** Run callMain once; returns out.json text or null. The profile is written to
 *  MEMFS by the caller first. NOTE: each worker runs exactly ONE sim — simc
 *  cannot re-run main() in-process (a 2nd callMain traps the wasm: "table index
 *  out of bounds" / "null function"), so the main-thread wrapper spawns a fresh
 *  worker (→ fresh module) per call and terminates it after. */
function runOnce(module: SimcModule, args: string[]): string | null {
  if (module.FS.analyzePath(OUT_PATH).exists) module.FS.unlink(OUT_PATH)
  dlog('[engine] callMain', args)
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
  dlog(
    `[engine] callMain returned ${code} in ${Math.round(performance.now() - t0)}ms · out.json exists=${exists}`,
  )
  return exists ? module.FS.readFile(OUT_PATH, { encoding: 'utf8' }) : null
}

async function simulate(
  input: SimInput,
  inspectOnly: boolean,
  onProgress?: (p: Partial<Progress>) => void,
  totalSets = 1,
): Promise<unknown> {
  onProgress?.({ phase: 'init', pct: 0 })
  currentOnProgress = onProgress ?? null
  currentTotalSets = totalSets
  stderrTail = []
  try {
    const module = await getModule()
    module.FS.writeFile(PROFILE_PATH, input.profile)
    const json = runOnce(module, buildArgs(input, inspectOnly))
    if (json === null) {
      throw new Error(
        'simc produced no report.' +
          (stderrTail.length ? `\n${stderrTail.slice(-20).join('\n')}` : ''),
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

  /** Top Gear: base profile + N profilesets in one batch (WEB_UI_PLAN §7 / 2a). */
  async runProfilesets(
    input: ProfilesetInput,
    onProgress: (p: Partial<Progress>) => void,
  ): Promise<ProfilesetReport> {
    const profile = buildProfilesetProfile(input)
    // simc runs the baseline plus every profileset, so the overall progress spans
    // N + 1 sets — that's what the set counter in the progress bar tops out at.
    const totalSets = input.profilesets.length + 1
    const raw = await simulate(
      { profile, options: input.options },
      false,
      onProgress,
      totalSets,
    )
    return parseProfilesetReport(raw)
  },
}

export type WasmWorkerApi = typeof api
Comlink.expose(api)
