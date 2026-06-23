import { SimOptionChips } from '@/features/sim-options/SimOptionChips'
import { ReportView } from '@/features/report/ReportView'
import { ProgressBody } from '@/features/quick-sim/ProgressBody'
import { useQuickSim } from '@/features/quick-sim/store'
import { SimcEditor } from './SimcEditor'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'

/**
 * Advanced mode (WEB_UI_PLAN U4): a raw `.simc` editor over the SAME engine path
 * and run-state store as Quick Sim. Near-free once Quick Sim works.
 */
export function Advanced() {
  const s = useQuickSim()
  const isReport = s.phase === 'report'
  const running = s.phase === 'running'

  return (
    <div className="flex flex-col">
      <div className="border-border-subtle mb-6 flex flex-wrap items-center gap-4 border-b pb-3">
        <h1 className="text-fg font-display text-sm font-semibold">
          Advanced
          {isReport && <span className="text-fg-faint"> › Report</span>}
        </h1>
        <div className="ml-auto">
          <SimOptionChips
            options={s.options}
            onChange={isReport ? undefined : s.setOptions}
            readOnly={isReport}
          />
        </div>
      </div>

      {isReport && s.report ? (
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={s.editProfile}
            className="border-border text-fg-muted hover:text-fg mr-auto rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            ← Back to editor
          </button>
          <ReportView report={s.report} />
        </div>
      ) : running ? (
        <ProgressBody />
      ) : (
        <div className="flex flex-col gap-4">
          <SimcEditor value={s.profile} onChange={s.setProfile} />
          {s.error && (
            <pre className="text-danger font-mono text-xs whitespace-pre-wrap">
              {s.error}
            </pre>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={s.run}
              disabled={!s.profile.trim()}
              className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:opacity-40"
            >
              Run simulation
            </button>
            <button
              type="button"
              onClick={() => s.setProfile(sampleProfile)}
              className="text-fg-faint hover:text-fg-muted text-xs underline"
            >
              Load example
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
