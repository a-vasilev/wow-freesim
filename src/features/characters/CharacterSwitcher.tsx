/**
 * Active-character switcher (CHARACTER_PERSISTENCE §7.1) — the two-step control in
 * the header strip that anchors the one-shared-profile model. Step 1 picks a
 * character; step 2 picks a loadout and binds the active draft to it. A footer
 * returns to the unsaved scratch paste or routes to the library. Switching while
 * the draft is dirty raises the discard warning (§6.6).
 */
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDownIcon, ChevronRightIcon } from '@/ui/icons'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { topIlvl, useCharacters } from './repository'
import { applyLoadout } from './draftActions'
import { useDirtyGuard } from './useDirtyGuard'
import { humanizeToken, realmLabel } from './format'
import type { Character, Loadout } from './types'

export function CharacterSwitcher() {
  const characters = useCharacters()
  const bound = useActiveDraft((s) => s.bound)
  const dirty = useActiveDraft((s) => s.dirty)
  const base = useActiveDraft((s) => s.base)
  const navigate = useNavigate()
  const { guard, dialog } = useDirtyGuard()

  const [open, setOpen] = useState(false)
  const [drillId, setDrillId] = useState<string | null>(null)

  const boundChar = bound
    ? characters?.find((c) => c.id === bound.characterId)
    : undefined
  const boundLoadout = boundChar?.loadouts.find(
    (l) => l.id === bound?.loadoutId,
  )

  function close() {
    setOpen(false)
    setDrillId(null)
  }

  function pickLoadout(c: Character, l: Loadout) {
    guard(() => {
      applyLoadout(c, l)
      close()
    })
  }

  function pickUnbound() {
    guard(() => {
      useActiveDraft.getState().selectUnbound()
      close()
    })
  }

  const drillChar = drillId
    ? characters?.find((c) => c.id === drillId)
    : undefined

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setDrillId(null)
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="border-border text-fg-muted hover:border-accent hover:text-accent hover:bg-accent-subtle flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            {dirty && (
              <span className="bg-accent size-1.5 shrink-0 rounded-full" />
            )}
            <TriggerLabel
              char={boundChar}
              loadout={boundLoadout}
              hasScratch={base.trim().length > 0}
            />
            <ChevronDownIcon className="text-fg-faint size-3" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="bg-surface-overlay border-border-subtle z-50 w-72 overflow-hidden rounded-md border shadow-lg"
          >
            {characters === undefined ? (
              <p className="text-fg-subtle px-3 py-4 text-sm">Loading…</p>
            ) : drillChar ? (
              <LoadoutStep
                character={drillChar}
                onBack={() => setDrillId(null)}
                onPick={(l) => pickLoadout(drillChar, l)}
              />
            ) : (
              <CharacterStep
                characters={characters}
                boundCharacterId={bound?.characterId}
                onDrill={setDrillId}
              />
            )}

            <div className="border-border-subtle flex flex-col border-t">
              <FooterRow onClick={pickUnbound} active={bound == null}>
                Unsaved paste
              </FooterRow>
              <FooterRow
                onClick={() => {
                  close()
                  void navigate({ to: '/characters' })
                }}
              >
                Manage characters →
              </FooterRow>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {dialog}
    </>
  )
}

function TriggerLabel({
  char,
  loadout,
  hasScratch,
}: {
  char?: Character
  loadout?: Loadout
  hasScratch: boolean
}) {
  if (char && loadout) {
    return (
      <span className="flex items-baseline gap-1">
        <span className="text-fg">{char.identity.name}</span>
        {char.identity.realm && (
          <span className="text-fg-muted">· {realmLabel(char.identity.realm)}</span>
        )}
        <span className="text-fg-faint">—</span>
        <span className="text-fg-muted">{loadout.name}</span>
      </span>
    )
  }
  return <span className="text-fg-muted">{hasScratch ? 'Unsaved paste' : 'No character'}</span>
}

/** Step 1 — one row per character; drills into its loadouts. */
function CharacterStep({
  characters,
  boundCharacterId,
  onDrill,
}: {
  characters: Character[]
  boundCharacterId?: string
  onDrill: (id: string) => void
}) {
  if (characters.length === 0) {
    return (
      <p className="text-fg-subtle px-3 py-4 text-sm">
        No saved characters yet. Save a paste to start a library.
      </p>
    )
  }
  return (
    <ul className="max-h-72 overflow-y-auto py-1">
      {characters.map((c) => {
        const active = c.id === boundCharacterId
        const ilvl = topIlvl(c)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onDrill(c.id)}
              className={`relative flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                active
                  ? 'bg-accent-subtle'
                  : 'hover:bg-surface-raised'
              }`}
            >
              {active && (
                <span className="bg-accent absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-sm" />
              )}
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
              <ChevronRightIcon className="text-fg-faint ml-auto size-3.5 shrink-0" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Step 2 — loadouts for the chosen character; selecting one binds the draft. */
function LoadoutStep({
  character,
  onBack,
  onPick,
}: {
  character: Character
  onBack: () => void
  onPick: (loadout: Loadout) => void
}) {
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={onBack}
        className="text-fg-muted hover:text-fg flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs transition-colors"
      >
        <ChevronRightIcon className="size-3 rotate-180" />
        <span className="text-fg truncate text-sm">{character.identity.name}</span>
      </button>
      <ul className="max-h-72 overflow-y-auto">
        {character.loadouts.map((l) => {
          const active = l.id === character.activeLoadoutId
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onPick(l)}
                className={`relative flex w-full flex-col px-3 py-2 text-left transition-colors ${
                  active ? 'bg-accent-subtle' : 'hover:bg-surface-raised'
                }`}
              >
                {active && (
                  <span className="bg-accent absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-sm" />
                )}
                <span className="text-fg text-sm">{l.name}</span>
                <span className="text-fg-muted text-xs tabular-nums">
                  {humanizeToken(l.spec)}
                  {l.ilvl != null && ` · ilvl ${l.ilvl}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FooterRow({
  onClick,
  active = false,
  children,
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:bg-surface-raised px-3 py-2 text-left text-xs transition-colors ${
        active ? 'text-accent' : 'text-fg-muted'
      }`}
    >
      {children}
    </button>
  )
}
