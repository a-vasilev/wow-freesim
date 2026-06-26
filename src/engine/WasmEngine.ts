/**
 * Main-thread handle to the wasm engine. Spawns a FRESH worker per call and
 * terminates it after — simc cannot re-run main() in one module instance (a 2nd
 * callMain traps the wasm), so each sim needs its own module, and terminating the
 * worker disposes its pthread pool cleanly (no leak). cancel() just terminates the
 * in-flight worker (it's blocked inside the synchronous callMain and can't answer
 * a message mid-run). Module spin-up is ~200ms, so per-call workers are cheap.
 */
import * as Comlink from 'comlink'
import type { SimEngine } from './SimEngine'
import type {
  EngineInfo,
  ParsedCharacter,
  ProfilesetInput,
  ProfilesetReport,
  Progress,
  SimInput,
  SimReport,
} from './schemas'
import type { WasmWorkerApi } from './wasm-worker'

export class EngineCancelledError extends Error {
  constructor() {
    super('Simulation cancelled')
    this.name = 'EngineCancelledError'
  }
}

export class WasmEngine implements SimEngine {
  #active: Worker | null = null
  #cancelInFlight: (() => void) | null = null

  /** Run `work` against a throwaway worker; terminate it on settle or cancel. */
  #perform<T>(
    work: (proxy: Comlink.Remote<WasmWorkerApi>) => Promise<T>,
  ): Promise<T> {
    // Single in-flight op, enforced here: the wasm can't re-run main() in one
    // module, so every call needs its own worker. If a previous op is still
    // running we'd otherwise orphan its worker (unreachable by cancel()/dispose(),
    // burning every core on the 107 MB module). Supersede it — latest call wins,
    // the prior promise rejects as cancelled. Callers serialize at the store level;
    // this is the backstop that guarantees the invariant rather than assuming it.
    this.#cancelInFlight?.()

    const worker = new Worker(new URL('./wasm-worker.ts', import.meta.url), {
      type: 'module',
      name: 'simc-engine',
    })
    const proxy = Comlink.wrap<WasmWorkerApi>(worker)
    this.#active = worker
    return new Promise<T>((resolve, reject) => {
      let settled = false
      // Tear down exactly once, then run the settling callback. Clears the shared
      // handles only if they still point at *this* worker (a superseding call may
      // have already replaced them).
      const finish = (settle: () => void) => {
        if (settled) return
        settled = true
        worker.terminate()
        if (this.#active === worker) this.#active = null
        if (this.#cancelInFlight === cancel) this.#cancelInFlight = null
        settle()
      }
      const cancel = () => finish(() => reject(new EngineCancelledError()))
      this.#cancelInFlight = cancel
      // A worker that dies OUTSIDE Comlink — OOM instantiating the 107 MB module, a
      // SharedArrayBuffer/isolation fault — never delivers a Comlink rejection.
      // Without these handlers the promise would hang in 'running' forever.
      worker.onerror = (e) =>
        finish(() =>
          reject(new Error(`Engine worker crashed: ${e.message || 'unknown error'}`)),
        )
      worker.onmessageerror = () =>
        finish(() => reject(new Error('Engine worker message channel error')))
      work(proxy).then(
        (v) => finish(() => resolve(v)),
        (e) => finish(() => reject(e)),
      )
    })
  }

  init(): Promise<EngineInfo> {
    return this.#perform((proxy) => proxy.init())
  }

  inspect(input: SimInput): Promise<ParsedCharacter> {
    return this.#perform((proxy) => proxy.inspect(input))
  }

  run(input: SimInput, onProgress: (p: Progress) => void): Promise<SimReport> {
    return this.#perform((proxy) =>
      proxy.run(input, this.#progressProxy(onProgress)),
    )
  }

  runProfilesets(
    input: ProfilesetInput,
    onProgress: (p: Progress) => void,
  ): Promise<ProfilesetReport> {
    return this.#perform((proxy) =>
      proxy.runProfilesets(input, this.#progressProxy(onProgress)),
    )
  }

  /** Accumulate partial progress into full Progress + stamp elapsed, over Comlink. */
  #progressProxy(onProgress: (p: Progress) => void) {
    const started = performance.now()
    let state: Progress = { phase: 'init', pct: 0 }
    return Comlink.proxy((p: Partial<Progress>) => {
      state = { ...state, ...p, elapsedMs: performance.now() - started }
      onProgress(state)
    })
  }

  cancel(): void {
    this.#cancelInFlight?.()
  }

  dispose(): void {
    // Reject any in-flight op first so its promise settles instead of hanging
    // (terminating the worker alone would strand the awaiting caller).
    this.#cancelInFlight?.()
    this.#active?.terminate()
    this.#active = null
  }
}
