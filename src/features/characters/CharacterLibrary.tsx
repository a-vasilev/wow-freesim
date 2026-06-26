/**
 * Characters library index (CHARACTER_PERSISTENCE §7.2) — a grid of character
 * cards. Clicking the card body opens the detail view; SET ACTIVE binds the
 * character's last-used loadout to the shared draft, RUN binds + jumps to Quick
 * Sim. Both routes go through the dirty-switch guard.
 */
import { Link, useNavigate } from '@tanstack/react-router'
import { ContentHeader } from '@/app/components/ContentHeader'
import { topIlvl, useCharacters } from './repository'
import { activeLoadoutOf, applyLoadout } from './draftActions'
import { useDirtyGuard } from './useDirtyGuard'
import { humanizeToken, realmLabel } from './format'
import type { Character } from './types'

export function CharacterLibrary() {
  const characters = useCharacters()
  const { guard, dialog } = useDirtyGuard()
  const navigate = useNavigate()

  const setActive = (c: Character) =>
    guard(() => applyLoadout(c, activeLoadoutOf(c)))

  const run = (c: Character) =>
    guard(() => {
      applyLoadout(c, activeLoadoutOf(c))
      void navigate({ to: '/quick-sim' })
    })

  return (
    <>
      <ContentHeader
        title="Characters"
        right={
          characters && characters.length > 0 ? (
            <span className="text-fg-faint text-xs">
              {characters.length}{' '}
              {characters.length === 1 ? 'character' : 'characters'}
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-1 flex-col px-7 py-6">
        {characters === undefined ? (
          <p className="text-fg-subtle text-sm">Loading…</p>
        ) : characters.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onSetActive={() => setActive(c)}
                onRun={() => run(c)}
              />
            ))}
          </div>
        )}
      </div>
      {dialog}
    </>
  )
}

function EmptyState() {
  return (
    <div className="border-border-subtle bg-surface-raised flex flex-col items-center gap-2 rounded-lg border px-6 py-16 text-center">
      <p className="text-fg font-display text-lg font-semibold">
        No characters yet
      </p>
      <p className="text-fg-muted max-w-md text-sm">
        Paste a <code className="font-mono">/simc</code> string in Quick Sim and
        choose{' '}
        <span className="text-fg-muted font-medium">Save as character</span> to
        start your roster — stored only on this device.
      </p>
      <Link
        to="/quick-sim"
        className="text-accent hover:text-accent-hover mt-2 text-sm"
      >
        Go to Quick Sim →
      </Link>
    </div>
  )
}

function CharacterCard({
  character,
  onSetActive,
  onRun,
}: {
  character: Character
  onSetActive: () => void
  onRun: () => void
}) {
  const ilvl = topIlvl(character)
  const meta = [
    humanizeToken(character.className),
    `${character.loadouts.length} ${character.loadouts.length === 1 ? 'loadout' : 'loadouts'}`,
    ilvl != null && `top ilvl ${ilvl}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="border-border-subtle bg-surface-raised hover:shadow-sm flex flex-col gap-3 rounded-lg border p-4 transition-shadow">
      <Link
        to="/characters/$id"
        params={{ id: character.id }}
        className="flex flex-col gap-1"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-fg font-display truncate text-2xl">
            {character.identity.name}
          </span>
          {character.identity.realm && (
            <span className="text-fg-muted shrink-0 text-sm">
              {realmLabel(character.identity.realm)}
            </span>
          )}
        </div>
        <span className="text-fg-muted text-sm tabular-nums">{meta}</span>
      </Link>

      <div className="border-border-subtle flex items-center gap-2 border-t pt-3">
        <button
          type="button"
          onClick={onSetActive}
          className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
        >
          Set active
        </button>
        <button
          type="button"
          onClick={onRun}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors"
        >
          Run
        </button>
        <span className="text-fg-faint ml-auto text-xs">
          updated {formatWhen(character.updatedAt)}
        </span>
      </div>
    </div>
  )
}

/** Compact relative timestamp (mirrors History's formatter). */
function formatWhen(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ms).toLocaleDateString()
}
