import type { FightStyle, SimOptions } from '@/engine'

/** Friendly labels for simc fight styles (the value sent is the simc enum). */
export const FIGHT_STYLE_LABELS: Record<FightStyle, string> = {
  Patchwerk: 'Single Target',
  DungeonSlice: 'Dungeon Slice',
  HecticAddCleave: 'Hectic Add Cleave',
  CleaveAdd: 'Cleave',
  HelterSkelter: 'Helter Skelter',
  LightMovement: 'Light Movement',
  HeavyMovement: 'Heavy Movement',
  Ultraxion: 'Ultraxion',
}

export const FIGHT_LENGTH_PRESETS = [60, 120, 300, 450] as const

/** Precision = the perf lever. Each preset is a target_error (lower = slower/precise). */
export const PRECISION_PRESETS = [
  { label: 'Fast', targetError: 0.5, blurb: 'Quickest — rougher estimate' },
  { label: 'Standard', targetError: 0.2, blurb: 'Balanced (recommended)' },
  { label: 'Precise', targetError: 0.05, blurb: 'Slowest — tightest convergence' },
] as const

export function precisionLabel(o: SimOptions): string {
  if (o.iterations) return `${o.iterations.toLocaleString()} iters`
  const match = PRECISION_PRESETS.find((p) => p.targetError === o.targetError)
  return match ? match.label : `error ${o.targetError}`
}
