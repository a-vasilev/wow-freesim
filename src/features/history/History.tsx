import { Link } from '@tanstack/react-router'
import { ContentHeader } from '@/app/components/ContentHeader'
import { deleteRun, useHistoryRuns, type HistoryRunMeta } from './db'

/**
 * Run history list (WEB_UI_PLAN U5): Dexie-backed, newest first. Each row deep-
 * links to the saved report (`/history/$runId`) and can be deleted. Save happens
 * from the report action row (SaveToHistory).
 */
export function History() {
  const runs = useHistoryRuns()

  return (
    <>
      <ContentHeader
        title="History"
        right={
          runs && runs.length > 0 ? (
            <span className="text-fg-faint text-xs">
              {runs.length} saved {runs.length === 1 ? 'run' : 'runs'}
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-7 py-6">
        {runs === undefined ? (
          <p className="text-fg-subtle text-sm">Loading…</p>
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div className="border-border-subtle bg-surface-raised flex flex-col items-center gap-2 rounded-lg border px-6 py-16 text-center">
      <p className="text-fg font-display text-lg font-semibold">
        No saved runs yet
      </p>
      <p className="text-fg-muted max-w-md text-sm">
        Run a sim, then choose{' '}
        <span className="text-fg-muted font-medium">Save to history</span> on
        the report to keep it here for later — entirely on this device.
      </p>
      <Link
        to="/quick-sim"
        className="text-accent hover:text-accent-hover mt-2 text-sm"
      >
        Go to Quick Sim →
      </Link>
    </div>
  )
}

function RunRow({ run }: { run: HistoryRunMeta }) {
  return (
    <li className="group border-border-subtle bg-surface-raised hover:border-border flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors">
      <Link
        to="/history/$runId"
        params={{ runId: run.id }}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-fg font-display truncate text-sm font-semibold">
            {run.characterName}
          </span>
          <span className="text-fg-muted truncate text-xs">
            <span className="text-accent uppercase">{run.specialization}</span>
            {run.fightStyle && ` · ${run.fightStyle}`}
            {run.targets != null && run.targets > 1 && ` · ${run.targets}T`}
            {run.fightLength != null && ` · ${run.fightLength}s`}
            {` · ${run.iterations.toLocaleString()} iters`}
          </span>
        </div>
        <div className="ml-auto flex flex-col items-end">
          <span className="text-dps font-display text-sm font-semibold tabular-nums">
            {Math.round(run.dps).toLocaleString()}
          </span>
          <span className="text-fg-faint text-xs">DPS</span>
        </div>
      </Link>
      <span className="text-fg-faint hidden w-28 text-right text-xs sm:block">
        {formatWhen(run.createdAt)}
      </span>
      <button
        type="button"
        onClick={() => void deleteRun(run.id)}
        aria-label={`Delete ${run.characterName} run`}
        className="text-fg-faint hover:text-danger rounded-md px-2 py-1 text-xs transition-colors"
      >
        Delete
      </button>
    </li>
  )
}

/** Compact relative timestamp; falls back to a date for older runs. */
function formatWhen(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ms).toLocaleDateString()
}
