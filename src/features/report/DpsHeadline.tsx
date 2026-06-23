import type { SimReport } from '@/engine'
import './report.css'

/** DPS headline block (DESIGN_SYSTEM §8.10): eyebrow, big number, accent unit,
 *  gradient underline, error/iteration meta. */
export function DpsHeadline({ report }: { report: SimReport }) {
  const { dps, meta } = report
  const errorPct =
    dps.meanStdDev && dps.mean ? (dps.meanStdDev / dps.mean) * 100 : undefined

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
        Damage per second
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-dps font-display text-7xl font-medium tabular-nums">
          {Math.round(dps.mean).toLocaleString()}
        </span>
        <span className="text-accent font-display text-2xl">DPS</span>
      </div>
      <div className="dps-underline w-full max-w-md" />
      <p className="text-fg-muted font-mono text-xs">
        {errorPct != null && `± ${errorPct.toFixed(2)}% · `}
        {meta.iterations.toLocaleString()} iterations
        {meta.fightStyle && ` · ${meta.fightStyle}`}
        {meta.targets != null && meta.targets > 1 && ` · ${meta.targets} targets`}
        {meta.fightLength != null && ` · ${meta.fightLength}s`}
      </p>
    </div>
  )
}
