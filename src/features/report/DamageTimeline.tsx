import { scaleLinear } from '@visx/scale'

/**
 * Damage-over-fight-time chart (WEB_UI_PLAN §6 / U5 report polish). Unlike the
 * histogram this is REAL data — simc's `collected_data.timeline_dmg.data`, the
 * mean damage per ~1s bucket across iterations. Rendered as a token-themed area
 * (gold gradient) + a lightly-smoothed line so burst windows read clearly.
 * Colors come from CSS vars at render — no hardcoded chart colors (§9).
 */
const W = 640
const H = 150
const M = { top: 10, right: 16, bottom: 24, left: 16 }

export function DamageTimeline({
  data,
  fightLength,
}: {
  data: number[]
  fightLength?: number
}) {
  if (data.length < 4) return null

  // Light moving-average smoothing (window scales with length) so the per-bucket
  // noise doesn't dominate; the area still reflects real magnitude.
  const win = Math.max(1, Math.round(data.length / 80))
  const smoothed = data.map((_, i) => {
    const lo = Math.max(0, i - win)
    const hi = Math.min(data.length - 1, i + win)
    let sum = 0
    for (let j = lo; j <= hi; j++) sum += data[j]
    return sum / (hi - lo + 1)
  })

  const n = smoothed.length
  const maxVal = Math.max(...smoothed) || 1
  // Bucket index ≈ seconds (simc default 1s bins); fall back to that if no length.
  const secPerBucket = fightLength && n ? fightLength / n : 1

  const xScale = scaleLinear({
    domain: [0, n - 1],
    range: [M.left, W - M.right],
  })
  const yScale = scaleLinear({
    domain: [0, maxVal],
    range: [H - M.bottom, M.top],
  })
  const baseline = H - M.bottom

  const pts = smoothed.map(
    (v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`,
  )
  const linePath = `M${pts.join('L')}`
  const areaPath = `M${xScale(0).toFixed(1)},${baseline} L${pts.join('L')} L${xScale(n - 1).toFixed(1)},${baseline} Z`

  const gridY = [0.25, 0.5, 0.75, 1].map((d) => yScale(d * maxVal))
  const xTicks = [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
        Damage over fight time
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        <title>Mean damage per second over the fight</title>
        <defs>
          <linearGradient id="dmg-timeline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-bar)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--c-bar)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <path d={areaPath} fill="url(#dmg-timeline-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--c-bar)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {xTicks.map((i, k) => (
          <text
            key={k}
            x={xScale(i)}
            y={H - 8}
            textAnchor={
              k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'
            }
            fill="var(--c-chart-axis)"
            className="font-mono"
            fontSize={11}
          >
            {Math.round(i * secPerBucket)}s
          </text>
        ))}
      </svg>
    </figure>
  )
}
