import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ItemCell } from '@/ui/item/ItemCell'
import { WowheadAttribution } from '@/ui/wowhead'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'
import { MAX_COMBOS, WARN_COMBOS, comboCount, type Selection } from './combos'
import type { GearSlot } from './gearModel'
import { useTopGear } from './store'

/** Compose-screen body: empty paste box, or the two-pane picker (§7 / 2a). */
export function GearComposeBody() {
  const { phase, model } = useTopGear()
  if (model && (phase === 'ready' || phase === 'inspecting')) {
    return <CandidatePicker />
  }
  return <EmptyPaste />
}

function EmptyPaste() {
  const { phase, error } = useTopGear()
  const profile = useActiveDraft((d) => d.base)
  const setProfile = useActiveDraft((d) => d.setBase)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 py-12">
      <label
        htmlFor="gear-paste"
        className="text-fg font-display text-sm font-semibold"
      >
        Paste your SimulationCraft string
      </label>
      <p className="text-fg-muted text-sm">
        Paste the string from the SimulationCraft in-game addon (
        <code className="font-mono">/simc</code>). Enable{' '}
        <span className="text-fg-subtle">bags &amp; bank</span> in the addon to
        find the best combination of gear you already own.
      </p>
      <textarea
        id="gear-paste"
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        spellCheck={false}
        placeholder={'warrior="My Character"\nlevel=80\n…'}
        className="bg-surface-inset border-border-subtle text-fg placeholder:text-fg-faint focus-visible:border-border h-56 w-full resize-y rounded-lg border p-4 font-mono text-sm outline-none"
      />
      <div className="flex items-center gap-3">
        {phase === 'inspecting' && (
          <span className="text-fg-subtle text-sm">Inspecting…</span>
        )}
        {error && <span className="text-danger text-sm">{error}</span>}
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => setProfile(sampleProfile)}
            className="text-fg-faint hover:text-fg-muted ml-auto text-xs underline"
          >
            Load example
          </button>
        )}
      </div>
    </div>
  )
}

/** First slot that has alternatives to consider, else the first slot. */
function defaultActiveKey(slots: GearSlot[]): string {
  return (slots.find((s) => s.candidates.length > 1) ?? slots[0])?.key ?? ''
}

function CandidatePicker() {
  const { model, selection, error, droppedItems } = useTopGear()
  const profile = useActiveDraft((d) => d.base)
  const setProfile = useActiveDraft((d) => d.setBase)
  const [activeKey, setActiveKey] = useState('')
  if (!model) return null

  const slots = model.slots
  const resolvedKey = activeKey || defaultActiveKey(slots)
  const active = slots.find((s) => s.key === resolvedKey) ?? slots[0]

  return (
    <div className="flex flex-col gap-5">
      <Collapsible.Root>
        <Collapsible.Trigger className="border-border-subtle text-fg-muted hover:text-fg flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors">
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            Profile source
          </span>
          <span className="text-fg-faint ml-auto text-xs">edit / replace</span>
        </Collapsible.Trigger>
        <Collapsible.Content className="pt-2">
          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            spellCheck={false}
            className="bg-surface-inset border-border-subtle text-fg h-40 w-full resize-y rounded-lg border p-3 font-mono text-xs outline-none"
          />
        </Collapsible.Content>
      </Collapsible.Root>

      {error && <span className="text-danger text-sm">{error}</span>}

      {droppedItems.length > 0 && (
        <p className="text-fg-faint text-xs">
          Hid {droppedItems.length}{' '}
          {droppedItems.length === 1 ? 'bag item' : 'bag items'} this character
          can&apos;t equip (wrong armor type, etc.).
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <EquippedPane
          slots={slots}
          selection={selection}
          activeKey={active?.key}
          onSelect={setActiveKey}
        />
        {active && (
          <CandidatePane slot={active} selected={selection[active.key] ?? []} />
        )}
      </div>

      <WowheadAttribution className="text-fg-faint text-xs" />
    </div>
  )
}

/** Left pane — the equipped paperdoll. Click a slot to edit its options. */
function EquippedPane({
  slots,
  selection,
  activeKey,
  onSelect,
}: {
  slots: GearSlot[]
  selection: Selection
  activeKey?: string
  onSelect: (key: string) => void
}) {
  return (
    <section className="border-border-subtle bg-surface-raised overflow-hidden rounded-lg border lg:w-80 lg:shrink-0">
      <header className="border-border-subtle border-b px-4 py-3">
        <span className="text-fg-muted text-xs font-semibold tracking-widest uppercase">
          Equipped
        </span>
      </header>
      <div className="flex flex-col gap-1.5 p-2">
        {slots.map((slot) => {
          const equipped = slot.candidates.find(
            (c) => c.uid === slot.equippedUid,
          )
          if (!equipped) return null
          const picks = selection[slot.key] ?? []
          const varied =
            picks.length > 1 ||
            (picks.length === 1 && picks[0] !== slot.equippedUid)
          return (
            <ItemCell
              key={slot.key}
              item={equipped.item}
              label={slot.label}
              interactive
              selected={slot.key === activeKey}
              onToggle={() => onSelect(slot.key)}
              trailing={varied ? <OptionCount n={picks.length} /> : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}

/** Right pane — every candidate for the active slot; multi-select to consider. */
function CandidatePane({
  slot,
  selected,
}: {
  slot: GearSlot
  selected: string[]
}) {
  const toggleCandidate = useTopGear((s) => s.toggleCandidate)
  return (
    <section className="border-border-subtle bg-surface-raised min-w-0 overflow-hidden rounded-lg border lg:flex-1">
      <header className="border-border-subtle border-b px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-fg font-display text-sm font-semibold">
            {slot.label}
          </h2>
          <span className="text-fg-faint text-xs tabular-nums">
            {slot.candidates.length}{' '}
            {slot.candidates.length === 1 ? 'option' : 'options'}
          </span>
        </div>
        <p className="text-fg-muted mt-1 text-xs">
          Select every item Top Gear should try in this slot.
        </p>
      </header>
      <div className="flex flex-col gap-1.5 p-2">
        {slot.candidates.map((cand) => (
          <ItemCell
            key={cand.uid}
            item={cand.item}
            interactive
            selected={selected.includes(cand.uid)}
            equipped={cand.uid === slot.equippedUid}
            onToggle={() => toggleCandidate(slot.key, cand.uid)}
          />
        ))}
      </div>
    </section>
  )
}

/** Small count chip on a varied slot row (how many items it's trying). */
function OptionCount({ n }: { n: number }) {
  return (
    <span className="bg-accent-subtle text-accent rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
      {n}
    </span>
  )
}

/** Live combination summary + caution. Rendered in the context bar area. */
export function ComboSummary() {
  const { model, selection } = useTopGear()
  if (!model) return null
  const count = comboCount(model, selection)
  const varied = countVariedSlots(model.slots, selection)
  const over = count > MAX_COMBOS
  const warn = !over && count > WARN_COMBOS

  return (
    <div className="flex flex-col items-end gap-0.5 text-right">
      <span className="text-fg font-mono text-sm tabular-nums">
        {count.toLocaleString()}{' '}
        <span className="text-fg-faint">
          {count === 1 ? 'combination' : 'combinations'}
        </span>
      </span>
      <span
        className={`text-xs ${
          over ? 'text-danger' : warn ? 'text-warning' : 'text-fg-faint'
        }`}
      >
        {over
          ? `Over the ${MAX_COMBOS} limit — narrow your picks`
          : warn
            ? `${varied} slots varied · this may take a while`
            : varied === 0
              ? 'Add an alternative to a slot'
              : `${varied} ${varied === 1 ? 'slot' : 'slots'} varied`}
      </span>
    </div>
  )
}

function countVariedSlots(slots: GearSlot[], sel: Selection): number {
  let n = 0
  for (const s of slots) {
    const picks = sel[s.key] ?? []
    if (
      picks.length > 1 ||
      (picks.length === 1 && picks[0] !== s.equippedUid)
    ) {
      n += 1
    }
  }
  return n
}
