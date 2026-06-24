/** Engine seam — public surface. Nothing outside this dir imports wasm. */
export type { SimEngine } from './SimEngine'
export {
  getEngine,
  createEngine,
  resolveEngineKind,
  type EngineKind,
} from './factory'
export { WasmEngine, EngineCancelledError } from './WasmEngine'
export { ENGINE_CONFIG, engineThreadCount } from './config'
export {
  parseCharacter,
  parseSimReport,
  parseProfilesetReport,
  parseEncodedItem,
} from './json2'
export {
  FIGHT_STYLES,
  DEFAULT_SIM_OPTIONS,
  SimInputSchema,
  SimOptionsSchema,
  ParsedCharacterSchema,
  SimReportSchema,
  ProfilesetInputSchema,
  ProfilesetReportSchema,
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
  type ProfilesetInput,
  type ProfilesetOverride,
  type ProfilesetResult,
  type ProfilesetReport,
  type EngineInfo,
  type Progress,
} from './schemas'
