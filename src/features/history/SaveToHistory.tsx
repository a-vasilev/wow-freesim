import { useState } from 'react'
import type { SimOptions, SimReport } from '@/engine'
import { saveRun } from './db'

/**
 * Save-to-history action (WEB_UI_PLAN U5) for the report action row. Persists the
 * report + its source profile/options to Dexie and reports a one-shot confirmation.
 * Lives in the history feature so report/ stays decoupled from the store.
 */
export function SaveToHistory({
  report,
  source,
}: {
  report: SimReport
  source: { profile: string; options: SimOptions }
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )

  const save = async () => {
    if (state === 'saving' || state === 'saved') return
    setState('saving')
    try {
      await saveRun(report, source.profile, source.options)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  const label =
    state === 'saved'
      ? 'Saved to history'
      : state === 'saving'
        ? 'Saving…'
        : state === 'error'
          ? 'Save failed — retry'
          : 'Save to history'

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === 'saving' || state === 'saved'}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-default ${
        state === 'saved'
          ? 'border-border-subtle text-success'
          : state === 'error'
            ? 'border-danger text-danger'
            : 'border-border text-fg-muted hover:text-fg hover:border-border-strong'
      }`}
    >
      {label}
    </button>
  )
}
