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
    const worker = new Worker(new URL('./wasm-worker.ts', import.meta.url), {
      type: 'module',
      name: 'simc-engine',
    })
    const proxy = Comlink.wrap<WasmWorkerApi>(worker)
    this.#active = worker
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const done = () => {
        worker.terminate()
        if (this.#active === worker) this.#active = null
        this.#cancelInFlight = null
      }
      this.#cancelInFlight = () => {
        if (settled) return
        settled = true
        done()
        reject(new EngineCancelledError())
      }
      work(proxy).then(
        (v) => {
          if (settled) return
          settled = true
          done()
          resolve(v)
        },
        (e) => {
          if (settled) return
          settled = true
          done()
          reject(e)
        },
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
    this.#active?.terminate()
    this.#active = null
  }
}
