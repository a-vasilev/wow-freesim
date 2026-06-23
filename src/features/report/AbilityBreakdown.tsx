import { useState } from 'react'
import type { SimReport } from '@/engine'
import { WowheadSpell } from '@/ui/wowhead'
import { useWowhead } from '@/ui/wowhead/wowhead'

/**
 * Ability damage breakdown (DESIGN_SYSTEM §8.11) with the "Show advanced"
 * progressive disclosure (§8.14) revealing Casts / CPM / Crit%. Ability icons +
 * tooltips come from the Wowhead spell embed.
 */
export function AbilityBreakdown({ report }: { report: SimReport }) {
  const [advanced, setAdvanced] = useState(false)
  useWowhead([report.abilities])
  const max = report.abilities[0]?.dps ?? 1
  const fightMin = (report.meta.fightLength ?? 300) / 60

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-fg font-display text-lg font-semibold">
          Ability breakdown
        </h2>
        <DisclosureToggle open={advanced} onClick={() => setAdvanced((v) => !v)} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-fg-faint border-border-subtle border-b text-left text-xs uppercase">
            <th className="py-1.5 font-semibold">Ability</th>
            <th className="py-1.5 text-right font-semibold">DPS</th>
            <th className="py-1.5 text-right font-semibold">%</th>
            <th className="w-32 py-1.5 font-semibold" />
            {advanced && (
              <>
                <th className="py-1.5 text-right font-semibold">Casts</th>
                <th className="py-1.5 text-right font-semibold">CPM</th>
                <th className="py-1.5 text-right font-semibold">Crit%</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {report.abilities.map((a, i) => (
            <tr
              key={`${a.id}-${a.name}-${i}`}
              className="ability-row border-border-subtle hover:bg-surface-inset border-b last:border-0"
            >
              <td className="py-1.5">
                {a.id > 0 ? (
                  <WowheadSpell
                    spellId={a.id}
                    className="text-fg hover:text-accent inline-flex items-center gap-1.5"
                  >
                    {a.name}
                  </WowheadSpell>
                ) : (
                  <span className="text-fg">{a.name}</span>
                )}
              </td>
              <td className="text-fg text-right font-mono tabular-nums">
                {Math.round(a.dps).toLocaleString()}
              </td>
              <td className="text-fg-muted text-right font-mono text-xs tabular-nums">
                {a.damagePct.toFixed(1)}
              </td>
              <td className="py-1.5">
                <div className="bg-bar-track h-1 w-full overflow-hidden rounded-sm">
                  {/* proportional bar width = allowlisted inline geometry (§11) */}
                  {/* eslint-disable no-restricted-syntax */}
                  <div
                    className="ability-bar-fill h-full rounded-sm"
                    style={{ width: `${Math.min(100, (a.dps / max) * 100)}%` }}
                  />
                  {/* eslint-enable no-restricted-syntax */}
                </div>
              </td>
              {advanced && (
                <>
                  <td className="text-fg-muted text-right font-mono text-xs tabular-nums">
                    {a.casts.toFixed(1)}
                  </td>
                  <td className="text-fg-muted text-right font-mono text-xs tabular-nums">
                    {(a.casts / fightMin).toFixed(1)}
                  </td>
                  <td className="text-fg-muted text-right font-mono text-xs tabular-nums">
                    {a.critPct != null ? a.critPct.toFixed(1) : '—'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function DisclosureToggle({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors ${
        open
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-border text-fg-muted hover:border-accent hover:bg-accent-subtle'
      }`}
    >
      Show advanced
      <span
        className={`inline-block transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      >
        ▸
      </span>
    </button>
  )
}
