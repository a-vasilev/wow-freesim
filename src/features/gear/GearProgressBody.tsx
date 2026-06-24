import { engineThreadCount } from '@/engine'
import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'
import { useThreadPref } from '@/features/sim-options/threads-store'
import { useTopGear } from './store'

/**
 * Top Gear progress (WEB_UI_PLAN §6.3 treatment, profileset-flavored). simc runs
 * the base + every set as one batch; the bar tracks its overall convergence. Per-
 * iteration DPS isn't in simc's stream, so there's no live number — just the set
 * count, convergence, and thread/core line.
 */
export function GearProgressBody() {
  const { progress, plans } = useTopGear()
  const pct = progress ? Math.round(progress.pct * 100) : 0

  const cores = hardwareConcurrency()
  const threads = engineThreadCount(
    cores,
    useThreadPref((s) => s.threads),
  )
  const isolated = isCrossOriginIsolated()

  const starting = !progress || progress.phase === 'init'
  const merging = progress?.phase === 'merging'
  const phaseLabel = starting
    ? 'Starting engine…'
    : merging
      ? 'Merging results…'
      : 'Simulating combinations…'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16">
      <div className="flex flex-col items-center gap-1">
        <p className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
          Top Gear
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-dps font-display text-6xl font-medium tabular-nums">
            {plans.length.toLocaleString()}
          </span>
          <span className="text-accent font-display text-xl">
            {plans.length === 1 ? 'set' : 'sets'}
          </span>
        </div>
      </div>

      <p className="text-fg-muted text-sm">{phaseLabel}</p>

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
        {progress?.iterations != null &&
          ` · ${progress.iterations.toLocaleString()}/${progress.totalIterations?.toLocaleString()} sets`}
        {progress?.elapsedMs != null &&
          ` · ${(progress.elapsedMs / 1000).toFixed(1)}s`}
      </p>

      <p className="text-fg-faint text-xs">
        Running on {threads} of {cores} {cores === 1 ? 'core' : 'cores'} ·{' '}
        {isolated ? 'multithreaded' : 'single-threaded (not isolated)'}
      </p>
    </div>
  )
}
