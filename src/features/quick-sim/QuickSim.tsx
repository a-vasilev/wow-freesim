import { useEffect } from 'react'
import { SimOptionChips } from '@/features/sim-options/SimOptionChips'
import { ReportView } from '@/features/report/ReportView'
import { ComposeBody } from './ComposeBody'
import { ProgressBody } from './ProgressBody'
import { looksLikeProfile, useQuickSim } from './store'

/**
 * Quick Sim — one route driven by the run-state machine (WEB_UI_PLAN §6). The
 * header strip + context bar are constant; only the body and the right-hand
 * controls change with phase.
 */
export function QuickSim() {
  const s = useQuickSim()
  const { phase, profile, inspect } = s

  // Debounced auto-inspect, keyed on the PROFILE only (§6.2). Depending on phase
  // would loop: inspect() flips phase ready→…→ready, re-arming the timer forever.
  // The phase is re-checked at fire time so we don't inspect during a run/report.
  useEffect(() => {
    if (!looksLikeProfile(profile)) return
    const t = setTimeout(() => {
      const ph = useQuickSim.getState().phase
      if (ph === 'running' || ph === 'report') return
      inspect()
    }, 600)
    return () => clearTimeout(t)
  }, [profile, inspect])

  const isReport = phase === 'report'
  const report = s.report

  return (
    <div className="flex flex-col">
      {/* Content header strip */}
      <div className="border-border-subtle mb-6 flex flex-wrap items-center gap-4 border-b pb-3">
        <h1 className="text-fg font-display text-sm font-semibold">
          Quick Sim{isReport && <span className="text-fg-faint"> › Report</span>}
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <SimOptionChips
            options={s.options}
            onChange={isReport ? undefined : s.setOptions}
            readOnly={isReport}
          />
          {isReport && (
            <button
              type="button"
              onClick={s.run}
              className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Re-run
            </button>
          )}
        </div>
      </div>

      {/* Character context bar */}
      {(s.character || phase === 'running' || isReport) && (
        <div className="border-border-subtle mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-fg font-display text-lg font-semibold">
              {s.character?.name ?? report?.character.name ?? 'Character'}
            </span>
            <span className="text-accent text-xs uppercase">
              {s.character?.specialization ?? report?.character.specialization}
            </span>
            {(s.character?.ilvl ?? report?.character.ilvl) != null && (
              <span className="text-fg-muted text-xs">
                ilvl {s.character?.ilvl ?? report?.character.ilvl}
              </span>
            )}
          </div>
          <ContextAction />
        </div>
      )}

      {/* Body */}
      {isReport && report ? (
        <ReportView report={report} />
      ) : phase === 'running' ? (
        <ProgressBody />
      ) : phase === 'error' ? (
        <ErrorPanel />
      ) : (
        <ComposeBody />
      )}
    </div>
  )
}

function ContextAction() {
  const { phase, run, cancel, character } = useQuickSim()
  if (phase === 'running') {
    return (
      <button
        type="button"
        onClick={cancel}
        className="border-border text-danger hover:border-danger rounded-md border px-4 py-2 text-sm font-semibold transition-colors"
      >
        Cancel
      </button>
    )
  }
  if (phase === 'report') {
    return null
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={!character}
      className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      Run simulation
    </button>
  )
}

function ErrorPanel() {
  const { error, run, editProfile } = useQuickSim()
  return (
    <div className="border-danger bg-surface-raised flex flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-danger font-display text-lg font-semibold">
        Simulation failed
      </h2>
      <pre className="text-fg-muted overflow-auto font-mono text-xs whitespace-pre-wrap">
        {error}
      </pre>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={run}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={editProfile}
          className="border-border text-fg-muted hover:text-fg rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          Edit profile
        </button>
      </div>
    </div>
  )
}
