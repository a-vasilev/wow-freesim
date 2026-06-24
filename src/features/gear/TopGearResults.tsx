import { useMemo } from 'react'
import type { ProfilesetResult } from '@/engine'
import { WowheadAttribution, WowheadItem } from '@/ui/wowhead'
import { useWowhead } from '@/ui/wowhead/wowhead'
import { useTopGear } from './store'
import type { SetChange } from './profilesets'

function humanize(name?: string): string {
  if (!name) return 'Item'
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Row {
  result: ProfilesetResult
  changes: SetChange[]
  delta: number
  deltaPct: number
}

/** Ranked Top Gear results (WEB_UI_PLAN §7). Baseline (current gear) pinned as the
 *  comparison anchor; sets ranked by DPS with Δ vs. baseline. */
export function TopGearResults() {
  const { report, plans } = useTopGear()
  const changesByName = useMemo(
    () => new Map(plans.map((p) => [p.name, p.changes])),
    [plans],
  )

  const rows: Row[] = useMemo(() => {
    if (!report) return []
    const base = report.baseline.dps.mean
    return [...report.sets]
      .map((result) => ({
        result,
        changes: changesByName.get(result.name) ?? [],
        delta: result.dps.mean - base,
        deltaPct: base > 0 ? ((result.dps.mean - base) / base) * 100 : 0,
      }))
      .sort((a, b) => b.result.dps.mean - a.result.dps.mean)
  }, [report, changesByName])

  // Re-scan Wowhead links whenever the rows render.
  useWowhead([rows])

  if (!report) return null

  const best = rows[0]
  const baselineDps = report.baseline.dps.mean

  return (
    <div className="flex flex-col gap-5">
      {/* Headline: best upgrade vs. current gear */}
      <div className="border-border-subtle bg-surface-raised flex flex-wrap items-end justify-between gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <p className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
            Best combination
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-dps font-display text-5xl font-medium tabular-nums">
              {Math.round(
                best?.result.dps.mean ?? baselineDps,
              ).toLocaleString()}
            </span>
            <span className="text-accent font-display text-xl">DPS</span>
          </div>
        </div>
        {best && (
          <div className="flex flex-col items-end gap-1">
            <DeltaText delta={best.delta} pct={best.deltaPct} large />
            <span className="text-fg-faint text-xs">
              vs. {Math.round(baselineDps).toLocaleString()} current ·{' '}
              {rows.length} {rows.length === 1 ? 'set' : 'sets'} simulated
            </span>
          </div>
        )}
      </div>

      <div className="border-border-subtle bg-surface-raised overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border-subtle text-fg-faint border-b text-xs tracking-wide uppercase">
              <th className="w-10 px-3 py-2.5 text-right font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Changes</th>
              <th className="px-3 py-2.5 text-right font-semibold">DPS</th>
              <th className="px-3 py-2.5 text-right font-semibold">Δ</th>
              <th className="px-3 py-2.5 text-right font-semibold">Δ%</th>
            </tr>
          </thead>
          <tbody>
            {/* Baseline anchor */}
            <tr className="border-border-subtle bg-surface-inset border-b">
              <td className="text-fg-faint px-3 py-2.5 text-right font-mono">
                —
              </td>
              <td className="text-fg-muted px-3 py-2.5">
                <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
                  Current gear
                </span>
              </td>
              <td className="text-fg px-3 py-2.5 text-right font-mono tabular-nums">
                {Math.round(baselineDps).toLocaleString()}
              </td>
              <td className="text-fg-faint px-3 py-2.5 text-right font-mono">
                —
              </td>
              <td className="text-fg-faint px-3 py-2.5 text-right font-mono">
                —
              </td>
            </tr>

            {rows.map((row, i) => (
              <tr
                key={row.result.name}
                className="border-border-subtle hover:bg-surface-overlay border-b transition-colors last:border-b-0"
              >
                <td className="text-fg-faint px-3 py-2.5 text-right font-mono">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {row.changes.map((c) => (
                      <span
                        key={c.slot}
                        className="flex items-baseline gap-1.5"
                      >
                        <span className="text-fg-faint text-xs uppercase">
                          {c.label}
                        </span>
                        <WowheadItem
                          item={c.item}
                          className="text-fg-muted hover:text-fg text-sm focus-visible:outline-none"
                        >
                          {humanize(c.item.name)}
                        </WowheadItem>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-fg px-3 py-2.5 text-right font-mono tabular-nums">
                  {Math.round(row.result.dps.mean).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  <DeltaText delta={row.delta} pct={row.deltaPct} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  <span
                    className={
                      row.delta >= 0
                        ? 'text-delta-positive'
                        : 'text-delta-negative'
                    }
                  >
                    {row.deltaPct >= 0 ? '+' : ''}
                    {row.deltaPct.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-fg-faint flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {report.metric} · {report.meta.iterations.toLocaleString()} iterations
          {report.meta.targetError != null &&
            ` · target_error ±${report.meta.targetError}`}
          {report.meta.fightStyle && ` · ${report.meta.fightStyle}`}
        </span>
        <WowheadAttribution />
      </div>
    </div>
  )
}

function DeltaText({
  delta,
  pct,
  large = false,
}: {
  delta: number
  pct: number
  large?: boolean
}) {
  const positive = delta >= 0
  return (
    <span
      className={`${positive ? 'text-delta-positive' : 'text-delta-negative'} ${
        large ? 'font-display text-2xl font-semibold' : ''
      } tabular-nums`}
    >
      {positive ? '+' : ''}
      {Math.round(delta).toLocaleString()}
      {large && (
        <span className="ml-1 text-sm">
          ({positive ? '+' : ''}
          {pct.toFixed(2)}%)
        </span>
      )}
    </span>
  )
}
