import { useQuickSim } from './store'

/** Progress screen body (WEB_UI_PLAN §6.3). Quiet, centered; cancel lives in the
 *  context bar. Live DPS isn't available mid-run (simc's progressbar reports only
 *  iterations), so we show convergence by iteration/target_error, not a number. */
export function ProgressBody() {
  const { progress } = useQuickSim()
  const pct = progress ? Math.round(progress.pct * 100) : 0
  const phaseLabel =
    progress?.phase === 'merging'
      ? 'Merging results…'
      : progress?.phase === 'init'
        ? 'Starting engine…'
        : 'Simulating…'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-16">
      <p className="text-fg-muted text-sm">{phaseLabel}</p>

      <div className="bg-bar-track h-2 w-full overflow-hidden rounded-full">
        {/* dynamic bar width = allowlisted inline geometry (§11) */}
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
          ` · ${progress.iterations.toLocaleString()}/${progress.totalIterations?.toLocaleString()} iterations`}
        {progress?.elapsedMs != null && ` · ${(progress.elapsedMs / 1000).toFixed(1)}s`}
      </p>
    </div>
  )
}
