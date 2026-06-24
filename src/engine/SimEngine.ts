/**
 * The engine seam. Every implementation (the real wasm engine, plus any
 * fixture/offline stand-in) satisfies this one typed contract; nothing in the UI
 * imports wasm directly. See WEB_UI_PLAN §3.
 */
import type {
  EngineInfo,
  ParsedCharacter,
  ProfilesetInput,
  ProfilesetReport,
  Progress,
  SimInput,
  SimReport,
} from './schemas'

export interface SimEngine {
  /** Boot/probe the engine. Reports threads, cores, version, isolation status. */
  init(): Promise<EngineInfo>

  /**
   * Parse-only pass: identity + gear ids + talent loadout, NO simulation.
   * Powers the compose-screen character preview. Cheap (minimal-iteration run).
   */
  inspect(input: SimInput): Promise<ParsedCharacter>

  /** Full simulation. Streams progress; resolves with the parsed report. */
  run(input: SimInput, onProgress: (p: Progress) => void): Promise<SimReport>

  /**
   * Top Gear: simulate the base profile + N profilesets (gear combinations) as
   * one batch, returning the baseline + per-set DPS results (WEB_UI_PLAN §7).
   */
  runProfilesets(
    input: ProfilesetInput,
    onProgress: (p: Progress) => void,
  ): Promise<ProfilesetReport>

  /** Request cancellation of an in-flight run() / runProfilesets(). */
  cancel(): void

  /** Release workers / wasm instance. */
  dispose?(): void
}

export type {
  EngineInfo,
  ParsedCharacter,
  ProfilesetInput,
  ProfilesetReport,
  Progress,
  SimInput,
  SimReport,
} from './schemas'
