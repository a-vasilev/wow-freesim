import type { SimReport } from '@/engine'
import { AbilityBreakdown } from './AbilityBreakdown'
import { DistributionHistogram } from './DistributionHistogram'
import { DpsHeadline } from './DpsHeadline'
import { UptimeGrid } from './UptimeGrid'

/** The report screen body (WEB_UI_PLAN §6.4), built to report.html minus the
 *  Stat Scaling block (deferred to Phase 4). */
export function ReportView({ report }: { report: SimReport }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <CharacterIdentity report={report} />

      <section className="border-border-subtle bg-surface-raised flex flex-col gap-6 rounded-lg border p-6">
        <DpsHeadline report={report} />
        <DistributionHistogram dps={report.dps} />
      </section>

      <AbilityBreakdown report={report} />

      <UptimeGrid title="Buff uptimes" uptimes={report.buffs} />
      <UptimeGrid title="Debuff uptimes" uptimes={report.debuffs} />

      <ReportActions report={report} />
    </div>
  )
}

function CharacterIdentity({ report }: { report: SimReport }) {
  const c = report.character
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-fg font-display text-3xl font-semibold">{c.name}</h1>
      <p className="text-fg-muted text-sm">
        <span className="text-accent uppercase">{c.specialization}</span>
        {' · '}
        {c.race} · level {c.level}
        {c.ilvl != null && ` · ilvl ${c.ilvl}`}
      </p>
    </header>
  )
}

function ReportActions({ report }: { report: SimReport }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.character.name}-report.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copySummary = async () => {
    const lines = [
      `${report.character.name} — ${report.character.specialization}`,
      `${Math.round(report.dps.mean).toLocaleString()} DPS (${report.meta.iterations} iterations, ${report.meta.fightStyle})`,
      '',
      ...report.abilities
        .slice(0, 15)
        .map(
          (a) =>
            `${a.name}: ${Math.round(a.dps).toLocaleString()} (${a.damagePct.toFixed(1)}%)`,
        ),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="border-border-subtle text-fg-muted flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
      <ActionButton onClick={copySummary}>Copy report</ActionButton>
      <ActionButton onClick={exportJson}>Export JSON</ActionButton>
      {report.meta.timestamp && (
        <span className="text-fg-faint ml-auto font-mono text-xs">
          {report.meta.simcVersion}
        </span>
      )}
    </div>
  )
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
    >
      {children}
    </button>
  )
}
