import * as Collapsible from '@radix-ui/react-collapsible'
import { GearPanel } from '@/features/character/GearPanel'
import { TalentPanel } from '@/features/character/TalentPanel'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { looksLikeProfile } from '@/lib/simcProfile'
import { NoCharacterRedirect } from '@/features/start/NoCharacterRedirect'
import { useQuickSim } from './store'

/**
 * Compose-screen body: the parsed character preview once one is loaded, a brief
 * scanning note while inspect() runs, otherwise a redirect to the `/start` source
 * step. The character source (paste / saved / Armory) now lives on `/start`, so a
 * scenario no longer carries its own paste box (§6.2).
 */
export function ComposeBody() {
  const { phase, character } = useQuickSim()
  const base = useActiveDraft((d) => d.base)
  if (character && (phase === 'ready' || phase === 'inspecting')) {
    return <ReadyPreview />
  }
  if (looksLikeProfile(base)) {
    return <p className="text-fg-subtle py-12 text-center text-sm">Scanning…</p>
  }
  return <NoCharacterRedirect scenario="sim it" />
}

function ReadyPreview() {
  const { character, phase, error } = useQuickSim()
  const profile = useActiveDraft((d) => d.base)
  const setProfile = useActiveDraft((d) => d.setBase)
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
