import { scaleLinear } from '@visx/scale'
import type { SampleStat } from '@/engine'

/**
 * DPS distribution histogram (DESIGN_SYSTEM §8.13). simc's json2 does NOT carry
 * the per-iteration distribution (see [[json2-no-dps-distribution]]), so this is
 * an APPROXIMATION: a normal curve derived from the mean + standard deviation
 * simc does report, binned into bars. Clearly labeled as such. Colors are fed
 * from tokens via CSS vars at render — no hardcoded chart colors (§9).
 */
const W = 640
const H = 180
const M = { top: 12, right: 16, bottom: 24, left: 16 }
const BINS = 41

export function DistributionHistogram({ dps }: { dps: SampleStat }) {
  const sigma = dps.stddev ?? (dps.max && dps.min ? (dps.max - dps.min) / 6 : 0)
  if (!sigma || !dps.mean) return null

  const lo = dps.mean - 3.5 * sigma
  const hi = dps.mean + 3.5 * sigma
  const binW = (hi - lo) / BINS

  const bars = Array.from({ length: BINS }, (_, i) => {
    const x = lo + (i + 0.5) * binW
    const z = (x - dps.mean) / sigma
    return { x, density: Math.exp(-0.5 * z * z) }
  })

  const xScale = scaleLinear({ domain: [lo, hi], range: [M.left, W - M.right] })
  const yScale = scaleLinear({ domain: [0, 1], range: [H - M.bottom, M.top] })
  const barPx = (W - M.left - M.right) / BINS

  const gridY = [0.25, 0.5, 0.75, 1].map((d) => yScale(d))
  const ticks = [lo, dps.mean, hi]

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        <title>Approximate DPS distribution</title>
        {gridY.map((y, i) => (
          <line
            key={i}
            x1={M.left}
            x2={W - M.right}
            y1={y}
            y2={y}
            stroke="var(--c-chart-grid)"
            strokeWidth={1}
          />
        ))}
        {bars.map((b, i) => {
          const top = yScale(b.density)
          return (
            <rect
              key={i}
              x={xScale(b.x) - barPx / 2 + 0.5}
              y={top}
              width={Math.max(1, barPx - 1)}
              height={H - M.bottom - top}
              fill="var(--c-bar)"
              opacity={0.85}
            />
          )
        })}
        <line
          x1={xScale(dps.mean)}
          x2={xScale(dps.mean)}
          y1={M.top}
          y2={H - M.bottom}
          stroke="var(--c-chart-mean)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        {ticks.map((t, i) => (
          <text
            key={i}
            x={xScale(t)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
            fill="var(--c-chart-axis)"
            className="font-mono"
            fontSize={11}
          >
            {Math.round(t).toLocaleString()}
          </text>
        ))}
      </svg>
      <figcaption className="text-fg-faint text-xs">
        Approximate distribution (normal curve from mean ± σ; simc does not export
        per-iteration data).
      </figcaption>
    </figure>
  )
}
