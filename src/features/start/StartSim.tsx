/**
 * The character-source step (the entry into a sim). The user loads a character
 * one of three ways — a saved character, a pasted `/simc` string, or an Armory
 * pull — then we *scan* it (the engine inspect()) and show what was found, and
 * finally let them launch the scenario of their choice. From the confirmation the
 * user can always go back and change their input.
 *
 * Every source converges on the one shared active draft (`setBase` / `applyLoadout`)
 * and the scan reuses Quick Sim's `inspect()`, so the parsed character carries
 * straight into whichever scenario they launch — no re-scan, no special-casing.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ContentHeader } from '@/app/components/ContentHeader'
import { GearPanel } from '@/features/character/GearPanel'
import { TalentPanel } from '@/features/character/TalentPanel'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { useQuickSim } from '@/features/quick-sim/store'
import { looksLikeProfile } from '@/lib/simcProfile'
import { ArmoryImportForm } from '@/features/characters/armory/ArmoryImportForm'
import { applyLoadout } from '@/features/characters/draftActions'
import { topIlvl, useCharacters } from '@/features/characters/repository'
import { humanizeToken, realmLabel } from '@/features/characters/format'
import type { Character, Loadout } from '@/features/characters/types'
import {
  ChevronRightIcon,
  DroptimizerIcon,
  GearIcon,
  QuickSimIcon,
} from '@/ui/icons'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'

type Step = 'source' | 'confirm'

export function StartSim() {
  const base = useActiveDraft((d) => d.base)
  // Returning users (a draft already loaded) skip straight to the confirmation.
  const [step, setStep] = useState<Step>(() =>
    looksLikeProfile(base) ? 'confirm' : 'source',
  )

  return (
    <>
      <ContentHeader title="Start a sim" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-7 py-10">
        {step === 'source' ? (
          <SourceStep onLoaded={() => setStep('confirm')} />
        ) : (
          <ConfirmStep onChange={() => setStep('source')} />
        )}
      </div>
    </>
  )
}

// ── Step 1: pick a source ─────────────────────────────────────────────────────

type SourceTab = 'saved' | 'paste' | 'armory'

const TABS: { id: SourceTab; label: string }[] = [
  { id: 'saved', label: 'Saved character' },
  { id: 'paste', label: 'Paste /simc' },
  { id: 'armory', label: 'Armory' },
]

function SourceStep({ onLoaded }: { onLoaded: () => void }) {
  const characters = useCharacters()
  const [tab, setTab] = useState<SourceTab>('saved')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg font-display text-2xl font-semibold tracking-tight">
          Load your character
        </h1>
        <p className="text-fg-muted text-sm">
          Pick a saved character, paste a{' '}
          <code className="font-mono">/simc</code> string, or pull it straight
          from the Armory.
        </p>
      </header>

      <div className="border-border-subtle flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'text-fg-muted hover:text-fg border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'saved' && (
        <SavedSource characters={characters} onPicked={onLoaded} />
      )}
      {tab === 'paste' && <PasteSource onContinue={onLoaded} />}
      {tab === 'armory' && (
        <div className="border-border-subtle bg-surface-raised rounded-lg border p-5">
          <ArmoryImportForm onImported={onLoaded} />
        </div>
      )}
    </div>
  )
}

/** Saved-character source: a character → loadout drill that binds the draft. */
function SavedSource({
  characters,
  onPicked,
}: {
  characters: Character[] | undefined
  onPicked: () => void
}) {
  const [drillId, setDrillId] = useState<string | null>(null)

  if (characters === undefined) {
    return <p className="text-fg-subtle py-6 text-sm">Loading…</p>
  }
  if (characters.length === 0) {
    return (
      <p className="text-fg-subtle py-6 text-sm">
        No saved characters yet. Paste a <code className="font-mono">/simc</code>{' '}
        string or import from the Armory to start your library.
      </p>
    )
  }

  const drill = drillId ? characters.find((c) => c.id === drillId) : undefined

  function pick(character: Character, loadout: Loadout) {
    applyLoadout(character, loadout)
    onPicked()
  }

  if (drill) {
    return (
      <div className="border-border-subtle bg-surface-raised overflow-hidden rounded-lg border">
        <button
          type="button"
          onClick={() => setDrillId(null)}
          className="text-fg-muted hover:text-fg border-border-subtle flex w-full items-center gap-1.5 border-b px-4 py-2.5 text-left text-xs transition-colors"
        >
          <ChevronRightIcon className="size-3 rotate-180" />
          <span className="text-fg text-sm">{drill.identity.name}</span>
        </button>
        <ul className="flex flex-col">
          {drill.loadouts.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => pick(drill, l)}
                className="hover:bg-surface-overlay flex w-full flex-col px-4 py-3 text-left transition-colors"
              >
                <span className="text-fg text-sm">{l.name}</span>
                <span className="text-fg-muted text-xs tabular-nums">
                  {humanizeToken(l.spec)}
                  {l.ilvl != null && ` · ilvl ${l.ilvl}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <ul className="border-border-subtle bg-surface-raised divide-border-subtle flex flex-col divide-y overflow-hidden rounded-lg border">
      {characters.map((c) => {
        const ilvl = topIlvl(c)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() =>
                // A single-loadout character needs no second click — bind it directly.
                c.loadouts.length === 1
                  ? pick(c, c.loadouts[0])
                  : setDrillId(c.id)
              }
              className="hover:bg-surface-overlay flex w-full items-center gap-2 px-4 py-3 text-left transition-colors"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-fg truncate text-sm">
                  {c.identity.name}
                  {c.identity.realm && (
                    <span className="text-fg-muted">
                      {' '}
                      · {realmLabel(c.identity.realm)}
                    </span>
                  )}
                </span>
                <span className="text-fg-muted text-xs tabular-nums">
                  {c.loadouts.length}{' '}
                  {c.loadouts.length === 1 ? 'loadout' : 'loadouts'}
                  {ilvl != null && ` · ilvl ${ilvl}`}
                </span>
              </span>
              {c.loadouts.length > 1 && (
                <ChevronRightIcon className="text-fg-faint ml-auto size-3.5 shrink-0" />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Paste source: the `/simc` textarea. Continue is enabled once it parses. */
function PasteSource({ onContinue }: { onContinue: () => void }) {
  const base = useActiveDraft((d) => d.base)
  const setBase = useActiveDraft((d) => d.setBase)
  const ready = looksLikeProfile(base)

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={base}
        onChange={(e) => setBase(e.target.value)}
        spellCheck={false}
        placeholder={'warrior="My Character"\nlevel=80\n…'}
        className="bg-surface-inset border-border-subtle text-fg placeholder:text-fg-faint focus-visible:border-border h-56 w-full resize-y rounded-lg border p-4 font-mono text-sm outline-none"
      />
      <div className="flex items-center gap-3">
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => setBase(sampleProfile)}
            className="text-fg-faint hover:text-fg-muted text-xs underline"
          >
            Load example
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!ready}
          className="bg-accent text-accent-fg hover:bg-accent-hover ml-auto rounded-md px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ── Step 2: confirm the scanned character, then launch a scenario ─────────────

function ConfirmStep({ onChange }: { onChange: () => void }) {
  const base = useActiveDraft((d) => d.base)
  const character = useQuickSim((s) => s.character)
  const phase = useQuickSim((s) => s.phase)
  const error = useQuickSim((s) => s.error)
  const inspect = useQuickSim((s) => s.inspect)

  // Scan the loaded profile on entry (and if the input changed underneath us).
  useEffect(() => {
    void inspect()
  }, [base, inspect])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-fg font-display text-2xl font-semibold tracking-tight">
          {character ? 'Character ready' : 'Scanning…'}
        </h1>
        <button
          type="button"
          onClick={onChange}
          className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
        >
          ← Change character
        </button>
      </div>

      {character ? (
        <>
          {/* Scenarios first — the character detail can grow tall (and will, once
              in-place gear editing lands), so keep the primary action above it. */}
          <ScenarioLauncher />
          <FoundCharacter />
        </>
      ) : error && phase !== 'inspecting' ? (
        <div className="border-danger bg-surface-raised flex flex-col gap-3 rounded-lg border p-6">
          <p className="text-danger text-sm">
            Couldn’t read that character.
          </p>
          <pre className="text-fg-muted overflow-auto font-mono text-xs whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      ) : (
        <p className="text-fg-subtle py-6 text-sm">
          Scanning your character…
        </p>
      )}
    </div>
  )
}

function FoundCharacter() {
  const character = useQuickSim((s) => s.character)
  if (!character) return null
  return (
    <div className="border-border-subtle bg-surface-raised flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-fg font-display text-lg font-semibold">
          {character.name}
        </span>
        {character.specialization && (
          <span className="text-accent text-xs uppercase">
            {character.specialization}
          </span>
        )}
        {character.ilvl != null && (
          <span className="text-fg-muted text-xs">ilvl {character.ilvl}</span>
        )}
      </div>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="lg:w-80 lg:shrink-0">
          <h2 className="text-fg font-display mb-3 text-sm font-semibold">Gear</h2>
          <GearPanel gear={character.gear} />
        </div>
        <div className="flex-1">
          <TalentPanel talents={character.talents} />
        </div>
      </div>
    </div>
  )
}

function ScenarioLauncher() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-3">
      <span className="text-fg-faint text-xs font-semibold tracking-widest uppercase">
        Choose a scenario
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScenarioCard
          icon={<QuickSimIcon className="size-5" />}
          title="Quick Sim"
          desc="A full DPS report for this character."
          onClick={() => void navigate({ to: '/quick-sim' })}
        />
        <ScenarioCard
          icon={<GearIcon className="size-5" />}
          title="Top Gear"
          desc="Rank every combination of gear you own."
          onClick={() => void navigate({ to: '/gear' })}
        />
      </div>
      <SoonCard
        icon={<DroptimizerIcon className="size-5" />}
        title="Droptimizer"
        desc="Sim upgrades from this tier’s loot — coming in a later phase."
      />
    </div>
  )
}

function ScenarioCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group border-border-subtle bg-surface-raised hover:border-accent focus-visible:ring-focus flex flex-col gap-2 rounded-lg border p-4 text-left outline-none transition-colors focus-visible:ring-2"
    >
      <span className="bg-accent-subtle text-accent flex size-9 items-center justify-center rounded-md">
        {icon}
      </span>
      <span className="text-fg group-hover:text-accent font-display text-base font-semibold transition-colors">
        {title}
      </span>
      <p className="text-fg-muted text-sm">{desc}</p>
    </button>
  )
}

function SoonCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div
      className="border-border-subtle flex items-center gap-3 rounded-lg border border-dashed p-4 opacity-70"
      aria-disabled="true"
    >
      <span className="bg-surface-inset text-fg-faint flex size-9 shrink-0 items-center justify-center rounded-md">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-fg-muted flex items-center gap-2 text-base font-semibold">
          {title}
          <span className="border-border-subtle text-fg-faint rounded-full border px-1.5 py-0.5 text-xs tracking-wide uppercase">
            Soon
          </span>
        </span>
        <p className="text-fg-faint text-sm">{desc}</p>
      </div>
    </div>
  )
}
