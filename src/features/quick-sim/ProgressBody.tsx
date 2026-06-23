import { engineThreadCount } from '@/engine'
import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'
import { useQuickSim } from './store'

/**
 * Progress screen body (WEB_UI_PLAN §6.3). A quiet, centered block: a DIMMED
 * preview of the report's DPS headline (§8.10 treatment), a convergence bar keyed
 * to iterations / target_error, and a thread/core-utilization line. Live mid-run
 * DPS is NOT in simc's output, so the estimate stays iteration/target_error-based
 * — the big number only fills in if a future engine patch streams `currentDps`.
 */
export function ProgressBody() {
  const { progress } = useQuickSim()
  const pct = progress ? Math.round(progress.pct * 100) : 0

  const cores = hardwareConcurrency()
  const threads = engineThreadCount(cores)
  const isolated = isCrossOriginIsolated()

  const starting = !progress || progress.phase === 'init'
  const merging = progress?.phase === 'merging'
  const phaseLabel = starting
    ? 'Starting engine…'
    : merging
      ? 'Merging results…'
      : 'Converging…'

  const dpsText =
    progress?.currentDps != null
      ? Math.round(progress.currentDps).toLocaleString()
      : '—'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16">
      {/* Dimmed converging DPS estimate (§8.10 treatment) */}
      <div className="flex flex-col items-center gap-2 opacity-45">
        <p className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
          Converging DPS estimate
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-dps font-display text-7xl font-medium tabular-nums">
            {dpsText}
          </span>
          <span className="text-accent font-display text-2xl">DPS</span>
        </div>
        <div className="bg-accent h-px w-full max-w-md opacity-40" />
      </div>

      <p className="text-fg-muted text-sm">{phaseLabel}</p>

      {/* Convergence bar (iterations / target_error) */}
      <div className="bg-bar-track h-2 w-full overflow-hidden rounded-full">
        {/* dynamic bar width = allowlisted inline geometry (DESIGN_SYSTEM §11) */}
        {/* eslint-disable no-restricted-syntax */}
        <div
          className="bg-bar h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
        {/* eslint-enable no-restricted-syntax */}
      </div>

      <p className="text-fg-subtle font-mono text-xs">
        {pct}%
        {progress?.targetError != null &&
          ` · target_error ±${progress.targetError.toFixed(2)}%`}
        {progress?.iterations != null &&
          ` · ${progress.iterations.toLocaleString()}/${progress.totalIterations?.toLocaleString()} iterations`}
        {progress?.elapsedMs != null &&
          ` · ${(progress.elapsedMs / 1000).toFixed(1)}s`}
      </p>

      {/* Thread / core utilization (tied to EngineInfo-equivalent host capability) */}
      <p className="text-fg-faint text-xs">
        Running on {threads} of {cores} {cores === 1 ? 'core' : 'cores'} ·{' '}
        {isolated ? 'multithreaded' : 'single-threaded (not isolated)'}
      </p>
    </div>
  )
}
