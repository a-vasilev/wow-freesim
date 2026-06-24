import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { FIGHT_STYLES, type FightStyle, type SimOptions } from '@/engine'
import { hardwareConcurrency } from '@/lib/crossOriginIsolated'
import {
  FIGHT_LENGTH_PRESETS,
  FIGHT_STYLE_LABELS,
  PRECISION_PRESETS,
  precisionLabel,
} from './presets'
import { useThreadPref } from './threads-store'

/**
 * The canonical sim-options UI (WEB_UI_PLAN §6.1, DESIGN_SYSTEM §8.2). One
 * representation, two modes: editable (each chip is a Radix Popover) on compose,
 * read-only on the report.
 */
export function SimOptionChips({
  options,
  onChange,
  readOnly = false,
}: {
  options: SimOptions
  onChange?: (next: SimOptions) => void
  readOnly?: boolean
}) {
  const set = (patch: Partial<SimOptions>) => onChange?.({ ...options, ...patch })

  return (
    <div className="border-border-subtle divide-border-subtle flex items-stretch divide-x overflow-hidden rounded-full border">
      <Chip k="Fight Style" v={FIGHT_STYLE_LABELS[options.fightStyle]} readOnly={readOnly}>
        <Section label="Fight Style">
          {FIGHT_STYLES.map((fs) => (
            <OptionRow
              key={fs}
              active={fs === options.fightStyle}
              onClick={() => set({ fightStyle: fs })}
            >
              {FIGHT_STYLE_LABELS[fs as FightStyle]}
            </OptionRow>
          ))}
        </Section>
      </Chip>

      <Chip k="Targets" v={String(options.targets)} readOnly={readOnly}>
        <Section label="Targets">
          <Stepper
            value={options.targets}
            min={1}
            max={30}
            onChange={(targets) => set({ targets })}
          />
        </Section>
      </Chip>

      <Chip k="Length" v={`${options.fightLength}s`} readOnly={readOnly}>
        <Section label="Fight Length">
          <div className="flex flex-wrap gap-1.5">
            {FIGHT_LENGTH_PRESETS.map((s) => (
              <Pill
                key={s}
                active={s === options.fightLength}
                onClick={() => set({ fightLength: s })}
              >
                {s}s
              </Pill>
            ))}
          </div>
        </Section>
      </Chip>

      <Chip k="Precision" v={precisionLabel(options)} readOnly={readOnly}>
        <Section label="Precision">
          <p className="text-fg-subtle mb-2 text-xs">
            Sets <code className="font-mono">target_error</code> — the main speed
            vs. accuracy lever.
          </p>
          {PRECISION_PRESETS.map((p) => (
            <OptionRow
              key={p.label}
              active={!options.iterations && p.targetError === options.targetError}
              onClick={() =>
                set({ targetError: p.targetError, iterations: undefined })
              }
            >
              <span className="flex flex-col">
                <span>{p.label}</span>
                <span className="text-fg-faint text-xs">{p.blurb}</span>
              </span>
            </OptionRow>
          ))}
        </Section>
      </Chip>

      {/* CPU threads — a host/perf preference, not a sim parameter, so it's only
          offered while editing (hidden on the read-only report). */}
      {!readOnly && <ThreadsChip />}
    </div>
  )
}

/**
 * Thread-count selector. Reads/writes the persisted preference directly (it's a
 * machine setting independent of the per-sim options). Hidden when the host can't
 * report more than one core — there's nothing to choose.
 */
function ThreadsChip() {
  const cores = hardwareConcurrency()
  const chosen = useThreadPref((s) => s.threads)
  const setThreads = useThreadPref((s) => s.setThreads)
  if (cores <= 1) return null

  const value = chosen ?? cores
  const isMax = chosen == null || chosen >= cores

  return (
    <Chip k="Threads" v={isMax ? `${value} · max` : String(value)} readOnly={false}>
      <Section label="CPU Threads">
        <p className="text-fg-subtle mb-2 text-xs">
          How many of your {cores} logical cores simc may use. More threads finish
          a sim faster; the result is unchanged.
        </p>
        <Stepper
          value={value}
          min={1}
          max={cores}
          // Picking the ceiling stores "auto" (null) so it tracks the hardware.
          onChange={(n) => setThreads(n >= cores ? null : n)}
        />
        <button
          type="button"
          onClick={() => setThreads(null)}
          disabled={isMax}
          className="text-fg-faint hover:text-fg mt-2 text-xs disabled:opacity-40"
        >
          Reset to max ({cores})
        </button>
      </Section>
    </Chip>
  )
}

function Chip({
  k,
  v,
  readOnly,
  children,
}: {
  k: string
  v: string
  readOnly: boolean
  children: ReactNode
}) {
  const inner = (
    <span className="bg-surface-overlay flex items-center gap-1.5 px-3 py-1.5">
      <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
        {k}
      </span>
      <span className="text-fg-muted text-xs">{v}</span>
    </span>
  )
  if (readOnly) return inner
  return (
    <Popover.Root>
      <Popover.Trigger className="hover:bg-surface-overlay focus-visible:ring-focus cursor-pointer outline-none focus-visible:ring-2">
        {inner}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="bg-surface-overlay border-border-subtle z-50 w-60 rounded-lg border p-3 shadow-lg"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-fg-subtle text-xs font-semibold tracking-wide uppercase">
        {label}
      </h3>
      {children}
    </div>
  )
}

function OptionRow({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? 'bg-accent-subtle text-accent'
          : 'text-fg-muted hover:bg-surface-raised hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-border-subtle text-fg-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="border-border text-fg-muted hover:text-fg h-7 w-7 rounded-md border text-lg leading-none"
      >
        −
      </button>
      <span className="text-fg w-8 text-center font-mono text-lg">{value}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="border-border text-fg-muted hover:text-fg h-7 w-7 rounded-md border text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}
