import { useEffect } from 'react'
import { ContentHeader } from '@/app/components/ContentHeader'
import { SimOptionChips } from '@/features/sim-options/SimOptionChips'
import { looksLikeProfile } from '@/lib/simcProfile'
import { MAX_COMBOS, comboCount, slotIsVaried } from './combos'
import { ComboSummary, GearComposeBody } from './GearComposeBody'
import { GearProgressBody } from './GearProgressBody'
import { TopGearResults } from './TopGearResults'
import { useTopGear } from './store'

/**
 * Top Gear — one route driven by a run-state machine, mirroring Quick Sim
 * (WEB_UI_PLAN §7 / increment 2a). Paste a `/simc` profile (equipped + bags),
 * pick candidate items per slot, sim every combination, rank the results. No item
 * catalog needed — candidates come from the profile; display from Wowhead.
 */
export function TopGear() {
  const s = useTopGear()
  const { phase, profile, inspect } = s

  // Debounced auto-inspect on profile change (parses the gear model + identity).
  useEffect(() => {
    if (!looksLikeProfile(profile)) return
    const t = setTimeout(() => {
      const ph = useTopGear.getState().phase
      if (ph === 'running' || ph === 'results') return
      inspect()
    }, 600)
    return () => clearTimeout(t)
  }, [profile, inspect])

  const isResults = phase === 'results'
  const showContextBar =
    isResults || phase === 'running' || (!!s.model && phase !== 'empty')

  // Runnable when ≥1 slot differs from the equipped baseline (a single forced
  // swap is count===1 but still a real plan) and we're within the combo cap.
  const count = s.model ? comboCount(s.model, s.selection) : 0
  const hasChange =
    !!s.model && s.model.slots.some((slot) => slotIsVaried(slot, s.selection))
  const runnable = hasChange && count <= MAX_COMBOS

  return (
    <>
      <ContentHeader
        title="Top Gear"
        crumb={isResults ? 'Results' : undefined}
        right={
          <>
            <SimOptionChips
              options={s.options}
              onChange={isResults ? undefined : s.setOptions}
              readOnly={isResults}
            />
            {isResults && (
              <>
                <HeaderButton onClick={s.edit}>Edit</HeaderButton>
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
                {s.character?.name ?? 'Character'}
              </span>
              {s.character?.specialization && (
                <span className="text-accent text-xs uppercase">
                  {s.character.specialization}
                </span>
              )}
              {s.character?.ilvl != null && (
                <span className="text-fg-muted text-xs">
                  ilvl {s.character.ilvl}
                </span>
              )}
            </div>
            <div className="flex items-center gap-5">
              {phase !== 'running' && !isResults && <ComboSummary />}
              <ContextAction runnable={runnable} />
            </div>
          </div>
        )}

        {isResults && s.report ? (
          <TopGearResults />
        ) : phase === 'running' ? (
          <GearProgressBody />
        ) : phase === 'error' ? (
          <ErrorPanel />
        ) : (
          <GearComposeBody />
        )}
      </div>
    </>
  )
}

function ContextAction({ runnable }: { runnable: boolean }) {
  const { phase, run, cancel } = useTopGear()
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
  return (
    <button
      type="button"
      onClick={run}
      disabled={!runnable}
      className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
    >
      Find best gear
    </button>
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

function ErrorPanel() {
  const { error, edit } = useTopGear()
  return (
    <div className="border-danger bg-surface-raised flex flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-danger font-display text-lg font-semibold">
        Top Gear failed
      </h2>
      <pre className="text-fg-muted overflow-auto font-mono text-xs whitespace-pre-wrap">
        {error}
      </pre>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={edit}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          Back to gear
        </button>
      </div>
    </div>
  )
}
