/** Engine seam — public surface. Nothing outside this dir imports wasm. */
export type { SimEngine } from './SimEngine'
export {
  getEngine,
  createEngine,
  resolveEngineKind,
  type EngineKind,
} from './factory'
export { WasmEngine, EngineCancelledError } from './WasmEngine'
export { ENGINE_CONFIG, ENGINE_THREAD_POOL, engineThreadCount } from './config'
export { parseCharacter, parseSimReport, parseEncodedItem } from './json2'
export {
  FIGHT_STYLES,
  DEFAULT_SIM_OPTIONS,
  SimInputSchema,
  SimOptionsSchema,
  ParsedCharacterSchema,
  SimReportSchema,
  EngineInfoSchema,
  type FightStyle,
  type SimOptions,
  type SimInput,
  type ParsedCharacter,
  type GearItem,
  type SimReport,
  type AbilityBreakdown,
  type Uptime,
  type SampleStat,
  type EngineInfo,
  type Progress,
} from './schemas'
