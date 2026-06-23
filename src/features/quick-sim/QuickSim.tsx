import { useEffect } from 'react'
import { ContentHeader, SubTab } from '@/app/components/ContentHeader'
import { SaveToHistory } from '@/features/history/SaveToHistory'
import { SimOptionChips } from '@/features/sim-options/SimOptionChips'
import { ReportView } from '@/features/report/ReportView'
import { AdvancedBody } from './AdvancedBody'
import { ComposeBody } from './ComposeBody'
import { ProgressBody } from './ProgressBody'
import { looksLikeProfile, useQuickSim } from './store'

/**
 * Quick Sim — one route driven by the run-state machine (WEB_UI_PLAN §6). The
 * 52px content header strip + context bar are constant; only the body and the
 * header's right-hand controls change with phase. Advanced mode is a sub-tab here
 * (not a separate route), feeding the same inspect()/run() path.
 */
export function QuickSim() {
  const s = useQuickSim()
  const { phase, mode, profile, inspect } = s

  // Debounced auto-inspect, COMPOSE mode only (§6.2). Keyed on the profile only:
  // depending on phase would loop (inspect flips phase ready→…→ready). The phase
  // is re-checked at fire time so we don't inspect during a run/report. Advanced
  // mode skips the preview — its editor body runs the profile directly.
  useEffect(() => {
    if (mode !== 'compose' || !looksLikeProfile(profile)) return
    const t = setTimeout(() => {
      const ph = useQuickSim.getState().phase
      if (ph === 'running' || ph === 'report') return
      inspect()
    }, 600)
    return () => clearTimeout(t)
  }, [profile, mode, inspect])

  const isReport = phase === 'report'
  const showContextBar =
    isReport || phase === 'running' || (mode === 'compose' && !!s.character)

  return (
    <>
      <ContentHeader
        title="Quick Sim"
        crumb={isReport ? 'Report' : undefined}
        tabs={
          isReport ? undefined : (
            <>
              <SubTab
                active={mode === 'compose'}
                onClick={() => s.setMode('compose')}
              >
                Compose
              </SubTab>
              <SubTab
                active={mode === 'advanced'}
                onClick={() => s.setMode('advanced')}
              >
                Advanced
              </SubTab>
            </>
          )
        }
        right={
          <>
            <SimOptionChips
              options={s.options}
              onChange={isReport ? undefined : s.setOptions}
              readOnly={isReport}
            />
            {isReport && (
              <>
                <HeaderButton onClick={s.editProfile}>Edit</HeaderButton>
                <HeaderButton onClick={s.run}>Re-run</HeaderButton>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-7 py-6">
        {showContextBar && (
          <div className="border-border-subtle flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-fg font-display text-lg font-semibold">
                {s.character?.name ?? s.report?.character.name ?? 'Character'}
              </span>
              <span className="text-accent text-xs uppercase">
                {s.character?.specialization ??
                  s.report?.character.specialization}
              </span>
              {(s.character?.ilvl ?? s.report?.character.ilvl) != null && (
                <span className="text-fg-muted text-xs">
                  ilvl {s.character?.ilvl ?? s.report?.character.ilvl}
                </span>
              )}
            </div>
            <ContextAction />
          </div>
        )}

        {isReport && s.report ? (
          <ReportView
            report={s.report}
            actions={
              <SaveToHistory
                report={s.report}
                source={{ profile: s.profile, options: s.options }}
              />
            }
          />
        ) : phase === 'running' ? (
          <ProgressBody />
        ) : phase === 'error' ? (
          <ErrorPanel />
        ) : mode === 'advanced' ? (
          <AdvancedBody />
        ) : (
          <ComposeBody />
        )}
      </div>
    </>
  )
}

function HeaderButton({
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
      className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
    >
      {children}
    </button>
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
      className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
