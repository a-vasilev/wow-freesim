import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  DEFAULT_SIM_OPTIONS,
  EngineCancelledError,
  getEngine,
  type EngineInfo,
  type ParsedCharacter,
  type Progress,
  type SimReport,
} from '@/engine'
import { EngineStatusChip } from '@/ui/EngineStatusChip'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'

export const Route = createFileRoute('/dev/engine')({
  component: DevEnginePage,
})

type Phase = 'idle' | 'booting' | 'inspecting' | 'running' | 'done' | 'error'

/**
 * Dev-only validation harness (WEB_UI_PLAN §5 U2): boots the real wasm engine,
 * confirms cross-origin isolation + threads, runs a pasted /simc end-to-end, and
 * dumps the parsed report. The de-risking spike, not polished UI.
 */
function DevEnginePage() {
  const engine = useRef(getEngine()).current
  const [phase, setPhase] = useState<Phase>('idle')
  const [info, setInfo] = useState<EngineInfo | null>(null)
  const [profile, setProfile] = useState(sampleProfile)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [character, setCharacter] = useState<ParsedCharacter | null>(null)
  const [report, setReport] = useState<SimReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const boot = async () => {
    setPhase('booting')
    setError(null)
    try {
      setInfo(await engine.init())
      setPhase('idle')
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const inspect = async () => {
    setPhase('inspecting')
    setError(null)
    setCharacter(null)
    try {
      setCharacter(
        await engine.inspect({ profile, options: DEFAULT_SIM_OPTIONS }),
      )
      setPhase('done')
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const run = async () => {
    setPhase('running')
    setError(null)
    setReport(null)
    setProgress(null)
    try {
      const r = await engine.run(
        { profile, options: DEFAULT_SIM_OPTIONS },
        setProgress,
      )
      setReport(r)
      setPhase('done')
    } catch (e) {
      if (e instanceof EngineCancelledError) setPhase('idle')
      else {
        setError(String(e))
        setPhase('error')
      }
    }
  }

  const busy =
    phase === 'booting' || phase === 'inspecting' || phase === 'running'

  return (
    <section className="flex flex-col gap-6 px-7 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-fg font-display text-2xl font-semibold">
            Engine validation
          </h1>
          <EngineStatusChip version={info?.version} />
        </div>
        <p className="text-fg-muted max-w-2xl text-sm">
          Boots <code className="font-mono">simc-wasm {`v1205.01`}</code> in a
          worker, runs a real client-side sim, and parses the result through the
          engine schemas. The de-risking spine (U2) — not the Quick Sim UI.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={boot} disabled={busy}>
          {info ? 'Re-boot engine' : 'Boot engine'}
        </Button>
        <Button onClick={inspect} disabled={busy}>
          Inspect (parse only)
        </Button>
        <Button onClick={run} disabled={busy} variant="accent">
          Run simulation
        </Button>
        {phase === 'running' && (
          <Button onClick={() => engine.cancel()} variant="danger">
            Cancel
          </Button>
        )}
      </div>

      {info && (
        <Panel title="EngineInfo">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <Stat label="implementation" value={info.implementation} />
            <Stat label="version" value={info.version} />
            <Stat
              label="isolated"
              value={String(info.crossOriginIsolated)}
              ok={info.crossOriginIsolated}
            />
            <Stat label="cores" value={String(info.cores)} />
            <Stat label="threads" value={String(info.threads)} />
          </dl>
        </Panel>
      )}

      {progress && (
        <Panel title={`Progress — ${progress.phase}`}>
          <div className="bg-bar-track h-2 w-full overflow-hidden rounded-full">
            {/* dynamic bar width = allowlisted inline geometry (DESIGN_SYSTEM §11) */}
            {/* eslint-disable no-restricted-syntax */}
            <div
              className="bg-bar h-full transition-all duration-200"
              style={{ width: `${Math.round(progress.pct * 100)}%` }}
            />
            {/* eslint-enable no-restricted-syntax */}
          </div>
          <p className="text-fg-subtle mt-2 font-mono text-xs">
            {Math.round(progress.pct * 100)}%
            {progress.iterations != null &&
              ` · ${progress.iterations}/${progress.totalIterations} iters`}
            {progress.elapsedMs != null &&
              ` · ${(progress.elapsedMs / 1000).toFixed(1)}s`}
          </p>
        </Panel>
      )}

      {error && (
        <Panel title="Error">
          <pre className="text-danger overflow-auto font-mono text-xs whitespace-pre-wrap">
            {error}
          </pre>
        </Panel>
      )}

      {character && (
        <Panel title="ParsedCharacter (inspect)">
          <p className="text-fg text-sm">
            <span className="text-accent font-medium">{character.name}</span> ·{' '}
            {character.specialization} · lvl {character.level} · ilvl{' '}
            {character.ilvl} · {character.gear.length} items
          </p>
          <pre className="text-fg-muted mt-2 max-h-64 overflow-auto font-mono text-xs">
            {JSON.stringify(character.gear, null, 2)}
          </pre>
        </Panel>
      )}

      {report && (
        <Panel title="SimReport">
          <p className="text-fg text-sm">
            <span className="text-dps font-display text-2xl font-semibold">
              {Math.round(report.dps.mean).toLocaleString()}
            </span>{' '}
            <span className="text-fg-subtle">
              DPS ± {Math.round(report.dps.meanStdDev ?? 0)} ·{' '}
              {report.character.name} · {report.meta.iterations} iters ·{' '}
              {report.meta.fightStyle}
            </span>
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-fg-subtle text-left text-xs">
                <th className="font-medium">Ability</th>
                <th className="text-right font-medium">DPS</th>
                <th className="text-right font-medium">%</th>
                <th className="text-right font-medium">Casts</th>
                <th className="text-right font-medium">Crit%</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {report.abilities.slice(0, 12).map((a, i) => (
                <tr key={`${a.id}-${i}`} className="text-fg-muted">
                  <td className="text-fg">{a.name}</td>
                  <td className="text-right">
                    {Math.round(a.dps).toLocaleString()}
                  </td>
                  <td className="text-right">{a.damagePct.toFixed(1)}</td>
                  <td className="text-right">{a.casts.toFixed(1)}</td>
                  <td className="text-right">{a.critPct?.toFixed(1) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="Profile (.simc)">
        <textarea
          className="bg-surface-inset border-border-subtle text-fg h-48 w-full resize-y rounded-lg border p-3 font-mono text-xs"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          spellCheck={false}
        />
      </Panel>
    </section>
  )
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'accent' | 'danger'
}) {
  const styles = {
    default:
      'bg-surface-overlay text-fg border-border hover:border-border-strong',
    accent: 'bg-accent text-accent-fg border-accent hover:bg-accent-hover',
    danger: 'bg-surface-overlay text-danger border-border hover:border-danger',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border-subtle bg-surface-raised flex flex-col gap-1 rounded-lg border p-4">
      <h2 className="text-fg-subtle text-xs font-medium tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-fg-subtle text-xs">{label}</dt>
      <dd className={`font-mono ${ok === false ? 'text-danger' : 'text-fg'}`}>
        {value}
      </dd>
    </div>
  )
}
