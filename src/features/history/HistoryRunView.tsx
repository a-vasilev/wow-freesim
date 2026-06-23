import { Link, useNavigate } from '@tanstack/react-router'
import { ContentHeader } from '@/app/components/ContentHeader'
import { ReportView } from '@/features/report/ReportView'
import { useQuickSim } from '@/features/quick-sim/store'
import { deleteRun, useRunPayload } from './db'

/**
 * Saved-run deep link (WEB_UI_PLAN U5): renders a persisted report by its stable
 * id. "Open in Quick Sim" rehydrates the run-state store (profile + options +
 * report) so it can be re-run or edited.
 */
export function HistoryRunView({ runId }: { runId: string }) {
  const payload = useRunPayload(runId)
  const navigate = useNavigate()

  if (payload === undefined) {
    return (
      <>
        <ContentHeader title="History" crumb="Run" />
        <div className="px-7 py-6">
          <p className="text-fg-subtle text-sm">Loading…</p>
        </div>
      </>
    )
  }

  if (payload === null) {
    return (
      <>
        <ContentHeader title="History" crumb="Run" />
        <div className="flex flex-col items-start gap-3 px-7 py-6">
          <p className="text-fg-muted text-sm">
            This run no longer exists (it may have been deleted).
          </p>
          <Link
            to="/history"
            className="text-accent hover:text-accent-hover text-sm"
          >
            ← Back to history
          </Link>
        </div>
      </>
    )
  }

  const { report, profile, options } = payload

  const openInQuickSim = () => {
    useQuickSim.getState().loadRun({ profile, options, report })
    void navigate({ to: '/quick-sim' })
  }

  const remove = async () => {
    await deleteRun(runId)
    void navigate({ to: '/history' })
  }

  return (
    <>
      <ContentHeader
        title="History"
        crumb={report.character.name}
        right={
          <Link
            to="/history"
            className="text-fg-muted hover:text-fg text-xs transition-colors"
          >
            ← All runs
          </Link>
        }
      />
      <div className="px-7 py-6">
        <ReportView
          report={report}
          actions={
            <>
              <button
                type="button"
                onClick={openInQuickSim}
                className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
              >
                Open in Quick Sim
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                className="border-border text-fg-muted hover:text-danger hover:border-danger rounded-md border px-3 py-1.5 text-sm transition-colors"
              >
                Delete
              </button>
            </>
          }
        />
      </div>
    </>
  )
}
