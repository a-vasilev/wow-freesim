import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'
import './engine-status.css'

/**
 * Engine status chip (DESIGN_SYSTEM §8.15). Reads isolation + core count from the
 * lightweight runtime guards — it does NOT boot the 107 MB engine (that stays lazy
 * until a real run). `version` enriches the text once the engine has loaded.
 */
export function EngineStatusChip({
  version,
  compact = false,
}: {
  version?: string
  compact?: boolean
}) {
  const isolated = isCrossOriginIsolated()
  const cores = hardwareConcurrency()

  // Icon-rail variant: just the status dot, full readout in the title tooltip.
  if (compact) {
    return (
      <span
        className="bg-surface-overlay border-border-subtle inline-flex items-center justify-center rounded-full border p-1.5"
        title={`${cores} ${cores === 1 ? 'core' : 'cores'} · ${
          isolated ? 'isolated' : 'not isolated'
        }${version ? ` · ${version}` : ''}`}
      >
        <span className="engine-dot" data-state={isolated ? 'on' : 'off'} />
      </span>
    )
  }

  return (
    <span className="bg-surface-overlay border-border-subtle text-fg-muted inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs">
      <span className="engine-dot" data-state={isolated ? 'on' : 'off'} />
      <span className="font-mono">
        {cores} {cores === 1 ? 'core' : 'cores'} ·{' '}
        {isolated ? 'isolated' : 'not isolated'}
        {version ? ` · ${version}` : ''}
      </span>
    </span>
  )
}
