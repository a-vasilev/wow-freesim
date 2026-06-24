import * as Collapsible from '@radix-ui/react-collapsible'
import { WowheadAttribution, WowheadItem } from '@/ui/wowhead'
import { useWowhead } from '@/ui/wowhead/wowhead'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'
import { MAX_COMBOS, WARN_COMBOS, comboCount, type Selection } from './combos'
import type { CandidateItem, GearSlot } from './gearModel'
import { useTopGear } from './store'

function humanize(name?: string): string {
  if (!name) return 'Item'
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Compose-screen body: empty paste box, or the candidate picker (§7 / 2a). */
export function GearComposeBody() {
  const { phase, model } = useTopGear()
  if (model && (phase === 'ready' || phase === 'inspecting')) {
    return <CandidatePicker />
  }
  return <EmptyPaste />
}

function EmptyPaste() {
  const { profile, setProfile, phase, error } = useTopGear()
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

function CandidatePicker() {
  const { model, selection, profile, setProfile, error, droppedItems } =
    useTopGear()
  useWowhead([model, selection])
  if (!model) return null

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

      <div className="flex flex-col gap-2">
        <h2 className="text-fg font-display text-sm font-semibold">
          Choose items to consider
        </h2>
        <p className="text-fg-muted text-sm">
          Each slot starts on your equipped item. Add alternatives (from your
          bags &amp; bank) and Top Gear sims every combination to find the best
          set.
        </p>
      </div>

      {droppedItems.length > 0 && (
        <p className="text-fg-faint text-xs">
          Hid {droppedItems.length}{' '}
          {droppedItems.length === 1 ? 'bag item' : 'bag items'} this character
          can&apos;t equip (wrong armor type, etc.).
        </p>
      )}

      <div className="border-border-subtle divide-border-subtle bg-surface-raised flex flex-col divide-y rounded-lg border">
        {model.slots.map((slot) => (
          <SlotRow
            key={slot.key}
            slot={slot}
            selected={selection[slot.key] ?? []}
          />
        ))}
      </div>

      <WowheadAttribution className="text-fg-faint text-xs" />
    </div>
  )
}

function SlotRow({ slot, selected }: { slot: GearSlot; selected: string[] }) {
  const toggleCandidate = useTopGear((s) => s.toggleCandidate)
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="text-fg-subtle w-24 shrink-0 pt-1.5 text-xs font-semibold tracking-wide uppercase">
        {slot.label}
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {slot.candidates.map((cand) => (
          <CandidateChip
            key={cand.uid}
            cand={cand}
            equipped={cand.uid === slot.equippedUid}
            selected={selected.includes(cand.uid)}
            onToggle={() => toggleCandidate(slot.key, cand.uid)}
          />
        ))}
      </div>
    </div>
  )
}

function CandidateChip({
  cand,
  equipped,
  selected,
  onToggle,
}: {
  cand: CandidateItem
  equipped: boolean
  selected: boolean
  onToggle: () => void
}) {
  return (
    <span className="inline-flex items-center">
      {/* The anchor is the toggle AND the Wowhead tooltip/icon host. preventDefault
          stops navigation; Wowhead's renameLinks fills in the real item name. */}
      <WowheadItem
        item={cand.item}
        aria-pressed={selected}
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none ${
          selected
            ? 'border-accent bg-accent-subtle text-fg'
            : 'border-border-subtle text-fg-muted hover:text-fg hover:border-border opacity-70'
        }`}
      >
        {humanize(cand.item.name)}
        {equipped && (
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            · Equipped
          </span>
        )}
      </WowheadItem>
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
