/**
 * Contextual save affordance for the compose bodies (CHARACTER_PERSISTENCE
 * §6.1/§6.2/§6.4, §7.3). Three states driven by the active draft:
 *  - unbound, parseable identity → "Save as character" (ghost) → auto-match dialog.
 *  - bound + dirty → "Update <loadout>" (primary) → writes the paste back (§6.4).
 *  - bound + clean, or no identity → nothing to do, renders null.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ParsedCharacter } from '@/engine'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { Dialog } from '@/ui/Dialog'
import { parseIdentity, type ParsedIdentity } from './parseIdentity'
import { humanizeToken, realmLabel } from './format'
import {
  addLoadout,
  createCharacter,
  findMatches,
  loadoutForSpec,
  updateLoadoutBase,
  useCharacters,
} from './repository'
import type { Character, Loadout } from './types'

export function SaveCharacterControl({
  character,
}: {
  /** The inspected preview, used only for the derived display ilvl. */
  character?: ParsedCharacter | null
}) {
  const base = useActiveDraft((s) => s.base)
  const bound = useActiveDraft((s) => s.bound)
  const dirty = useActiveDraft((s) => s.dirty)
  const characters = useCharacters()
  const [dialogOpen, setDialogOpen] = useState(false)

  const identity = useMemo(() => parseIdentity(base), [base])
  const ilvl = character?.ilvl
  if (!identity) return null

  if (bound) {
    if (!dirty) return null
    const loadout = characters
      ?.find((c) => c.id === bound.characterId)
      ?.loadouts.find((l) => l.id === bound.loadoutId)
    return (
      <button
        type="button"
        onClick={async () => {
          await updateLoadoutBase(bound.characterId, bound.loadoutId, base, ilvl)
          useActiveDraft.setState({ dirty: false })
        }}
        className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
      >
        Update {loadout ? `“${loadout.name}”` : 'loadout'}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
      >
        Save as character
      </button>
      {dialogOpen && (
        <SaveCharacterDialog
          identity={identity}
          base={base}
          ilvl={ilvl}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  )
}

function SaveCharacterDialog({
  identity,
  base,
  ilvl,
  onClose,
}: {
  identity: ParsedIdentity
  base: string
  ilvl?: number
  onClose: () => void
}) {
  const [matches, setMatches] = useState<Character[] | null>(null)
  useEffect(() => {
    let alive = true
    findMatches(identity).then((m) => alive && setMatches(m))
    return () => {
      alive = false
    }
  }, [identity])

  const bindTo = (characterId: string, loadoutId: string) => {
    useActiveDraft.getState().bind(characterId, loadoutId)
    onClose()
  }

  const newLoadout = {
    name: humanizeToken(identity.spec),
    spec: identity.spec ?? 'default',
    base,
    ilvl,
  }

  const saveNewCharacter = async () => {
    const { characterId, loadoutId } = await createCharacter({
      identity: { name: identity.name, realm: identity.realm },
      className: identity.className,
      race: identity.race ?? 'unknown',
      loadout: newLoadout,
    })
    bindTo(characterId, loadoutId)
  }

  const addAsLoadout = async (c: Character) => {
    const loadoutId = await addLoadout(c.id, newLoadout)
    bindTo(c.id, loadoutId)
  }

  const updateExisting = async (c: Character, l: Loadout) => {
    await updateLoadoutBase(c.id, l.id, base, ilvl)
    bindTo(c.id, l.id)
  }

  const summary = [
    humanizeToken(identity.className),
    identity.spec && humanizeToken(identity.spec),
    ilvl != null && `ilvl ${ilvl}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Save character"
      description={
        <>
          <span className="text-fg">{identity.name}</span>
          {identity.realm && (
            <span> · {realmLabel(identity.realm)}</span>
          )}
          {summary && <span className="text-fg-faint"> — {summary}</span>}
        </>
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        {matches === null ? (
          <p className="text-fg-subtle text-sm">Checking your library…</p>
        ) : matches.length === 0 ? (
          <p className="text-fg-muted text-sm">
            No saved character matches this paste.
          </p>
        ) : (
          <>
            <p className="text-fg-muted text-sm">
              {matches.length === 1
                ? 'This character is already in your library:'
                : 'Matching characters in your library:'}
            </p>
            {identity.realm == null && (
              <p className="text-fg-faint text-xs">
                Matched by name only — this paste has no realm.
              </p>
            )}
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                character={m}
                spec={identity.spec}
                onUpdate={(l) => void updateExisting(m, l)}
                onAddLoadout={() => void addAsLoadout(m)}
              />
            ))}
          </>
        )}
      </div>

      <div className="border-border-subtle mt-4 flex items-center justify-end gap-3 border-t pt-4">
        <button
          type="button"
          onClick={onClose}
          className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void saveNewCharacter()}
          className={
            matches && matches.length > 0
              ? 'border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors'
              : 'bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-sm font-semibold transition-colors'
          }
        >
          Save as new character
        </button>
      </div>
    </Dialog>
  )
}

/** One matched character with its update/add-loadout actions. */
function MatchCard({
  character,
  spec,
  onUpdate,
  onAddLoadout,
}: {
  character: Character
  spec?: string
  onUpdate: (loadout: Loadout) => void
  onAddLoadout: () => void
}) {
  const sameSpec = loadoutForSpec(character, spec)
  const others = character.loadouts.filter((l) => l.id !== sameSpec?.id)

  return (
    <div className="border-border-subtle bg-surface-inset flex flex-col gap-2 rounded-md border p-3">
      <div className="text-fg text-sm">
        {character.identity.name}
        {character.identity.realm && (
          <span className="text-fg-muted">
            {' '}
            · {realmLabel(character.identity.realm)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {sameSpec && (
          <button
            type="button"
            onClick={() => onUpdate(sameSpec)}
            className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-left text-sm font-semibold transition-colors"
          >
            Update “{sameSpec.name}”
          </button>
        )}
        <button
          type="button"
          onClick={onAddLoadout}
          className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-left text-sm transition-colors"
        >
          Add {humanizeToken(spec) || 'this'} as a new loadout
        </button>
        {!sameSpec &&
          others.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onUpdate(l)}
              className="text-fg-muted hover:text-fg px-1 py-0.5 text-left text-xs transition-colors"
            >
              …or overwrite “{l.name}” ({humanizeToken(l.spec)})
            </button>
          ))}
      </div>
    </div>
  )
}
