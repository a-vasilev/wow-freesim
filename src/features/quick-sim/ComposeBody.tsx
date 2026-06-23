import * as Collapsible from '@radix-ui/react-collapsible'
import { GearPanel } from '@/features/character/GearPanel'
import { TalentPanel } from '@/features/character/TalentPanel'
import { useQuickSim } from './store'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'

/** Compose-screen body: empty paste box, or the parsed character preview (§6.2). */
export function ComposeBody() {
  const { phase, character } = useQuickSim()
  if (character && (phase === 'ready' || phase === 'inspecting')) {
    return <ReadyPreview />
  }
  return <EmptyPaste />
}

function EmptyPaste() {
  const { profile, setProfile, phase, error } = useQuickSim()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 py-12">
      <label
        htmlFor="simc-paste"
        className="text-fg font-display text-sm font-semibold"
      >
        Paste your SimulationCraft string
      </label>
      <p className="text-fg-muted text-sm">
        Paste the string from the SimulationCraft in-game addon (
        <code className="font-mono">/simc</code>) to load your character.
      </p>
      <textarea
        id="simc-paste"
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

function ReadyPreview() {
  const { character, profile, setProfile, phase, error } = useQuickSim()
  if (!character) return null
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

      {phase === 'inspecting' && (
        <span className="text-fg-subtle text-sm">Re-inspecting…</span>
      )}
      {error && <span className="text-danger text-sm">{error}</span>}

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="border-border-subtle bg-surface-raised rounded-lg border p-4 lg:w-80 lg:shrink-0">
          <h2 className="text-fg font-display mb-3 text-sm font-semibold">Gear</h2>
          <GearPanel gear={character.gear} />
        </div>
        <div className="border-border-subtle bg-surface-raised flex-1 rounded-lg border p-4">
          <TalentPanel talents={character.talents} />
        </div>
      </div>
    </div>
  )
}
