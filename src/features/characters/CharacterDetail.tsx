/**
 * Character detail (CHARACTER_PERSISTENCE §7.2) — the surface that grows into
 * editing (Phase 3). Two panes reusing the gear screen's composition: a left
 * loadouts list (select + per-row actions) and a right pane reusing the existing
 * GearPanel / TalentPanel for the selected loadout (read-only in Phase 2). The
 * header "Run ▾" binds the selected loadout and jumps to a sim.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import * as Popover from '@radix-ui/react-popover'
import { ContentHeader } from '@/app/components/ContentHeader'
import { GearPanel } from '@/features/character/GearPanel'
import { TalentPanel } from '@/features/character/TalentPanel'
import { ChevronDownIcon } from '@/ui/icons'
import { Dialog } from '@/ui/Dialog'
import { buildProfile } from './buildProfile'
import { useInspectedCharacter } from './useInspectedCharacter'
import { applyLoadout, activeLoadoutOf } from './draftActions'
import { useDirtyGuard } from './useDirtyGuard'
import { humanizeToken, realmLabel } from './format'
import {
  deleteLoadout,
  duplicateLoadout,
  renameLoadout,
  setActiveLoadout,
  setLoadoutIlvl,
  useCharacter,
} from './repository'
import type { Character, Loadout } from './types'

type SimTarget = '/quick-sim' | '/gear'

export function CharacterDetail({ id }: { id: string }) {
  const character = useCharacter(id)
  const navigate = useNavigate()
  const { guard, dialog } = useDirtyGuard()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Loadout | null>(null)

  if (character === undefined) {
    return (
      <>
        <ContentHeader title="Characters" crumb="…" />
        <div className="px-7 py-6">
          <p className="text-fg-subtle text-sm">Loading…</p>
        </div>
      </>
    )
  }
  if (character === null) {
    return (
      <>
        <ContentHeader title="Characters" crumb="Not found" />
        <div className="flex flex-col items-start gap-3 px-7 py-6">
          <p className="text-fg-muted text-sm">
            This character no longer exists.
          </p>
          <Link to="/characters" className="text-accent text-sm">
            ← Back to characters
          </Link>
        </div>
      </>
    )
  }

  const selected =
    character.loadouts.find((l) => l.id === selectedId) ??
    activeLoadoutOf(character)

  const runLoadout = (l: Loadout, to: SimTarget) =>
    guard(() => {
      applyLoadout(character, l)
      void navigate({ to })
    })

  const addLoadout = async () => {
    const newId = await duplicateLoadout(character.id, selected.id)
    if (newId) setSelectedId(newId)
  }

  return (
    <>
      <ContentHeader
        title={
          <Link to="/characters" className="hover:text-accent transition-colors">
            Characters
          </Link>
        }
        crumb={character.identity.name}
        right={<RunMenu onRun={(to) => runLoadout(selected, to)} />}
      />

      <div className="flex flex-1 flex-col gap-5 px-7 py-6">
        {/* Character context bar */}
        <div className="border-border-subtle flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-fg font-display text-3xl">
              {character.identity.name}
            </span>
            {character.identity.realm && (
              <span className="text-fg-muted text-sm">
                · {realmLabel(character.identity.realm)}
              </span>
            )}
            <span className="text-fg-muted text-sm">
              {humanizeToken(character.className)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void addLoadout()}
            className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            + Add loadout
          </button>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <LoadoutList
            character={character}
            selectedId={selected.id}
            onSelect={setSelectedId}
            onSetActive={(l) => void setActiveLoadout(character.id, l.id)}
            onRename={setRenaming}
            onDuplicate={async (l) => {
              const newId = await duplicateLoadout(character.id, l.id)
              if (newId) setSelectedId(newId)
            }}
            onRun={runLoadout}
            onDelete={(l) => void deleteLoadout(character.id, l.id)}
          />
          <LoadoutDetail character={character} loadout={selected} />
        </div>
      </div>

      {renaming && (
        <RenameDialog
          loadout={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            await renameLoadout(character.id, renaming.id, name)
            setRenaming(null)
          }}
        />
      )}
      {dialog}
    </>
  )
}

/** Header split button: Run (Quick Sim) with a menu for Quick Sim / Top Gear. */
function RunMenu({ onRun }: { onRun: (to: SimTarget) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => onRun('/quick-sim')}
        className="bg-accent text-accent-fg hover:bg-accent-hover rounded-l-md px-4 py-1.5 text-sm font-semibold transition-colors"
      >
        Run
      </button>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Choose simulation"
            className="bg-accent text-accent-fg hover:bg-accent-hover border-accent-fg/20 rounded-r-md border-l px-2 transition-colors"
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="bg-surface-overlay border-border-subtle z-50 w-40 overflow-hidden rounded-md border py-1 shadow-lg"
          >
            <MenuItem
              onClick={() => {
                setOpen(false)
                onRun('/quick-sim')
              }}
            >
              Quick Sim
            </MenuItem>
            <MenuItem
              onClick={() => {
                setOpen(false)
                onRun('/gear')
              }}
            >
              Top Gear
            </MenuItem>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

function LoadoutList({
  character,
  selectedId,
  onSelect,
  onSetActive,
  onRename,
  onDuplicate,
  onRun,
  onDelete,
}: {
  character: Character
  selectedId: string
  onSelect: (id: string) => void
  onSetActive: (l: Loadout) => void
  onRename: (l: Loadout) => void
  onDuplicate: (l: Loadout) => void
  onRun: (l: Loadout, to: SimTarget) => void
  onDelete: (l: Loadout) => void
}) {
  return (
    <section className="flex flex-col gap-1.5 lg:w-80 lg:shrink-0">
      <h2 className="text-fg-muted px-1 text-xs font-semibold tracking-widest uppercase">
        Loadouts
      </h2>
      {character.loadouts.map((l) => {
        const active = l.id === character.activeLoadoutId
        const selected = l.id === selectedId
        return (
          <div
            key={l.id}
            className={`relative flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
              selected
                ? 'border-accent bg-accent-subtle'
                : 'border-border-subtle bg-surface-inset hover:border-border'
            }`}
          >
            {selected && (
              <span className="bg-accent absolute top-2 bottom-2 left-0 w-0.5 rounded-sm" />
            )}
            <button
              type="button"
              onClick={() => onSelect(l.id)}
              className="flex min-w-0 flex-1 flex-col text-left"
            >
              <span className="text-fg truncate text-sm">{l.name}</span>
              <span className="text-fg-muted text-xs tabular-nums">
                {humanizeToken(l.spec)}
                {l.ilvl != null && ` · ilvl ${l.ilvl}`}
                {active && ' · active'}
              </span>
            </button>
            <LoadoutMenu
              loadout={l}
              isActive={active}
              onSetActive={() => onSetActive(l)}
              onRename={() => onRename(l)}
              onDuplicate={() => onDuplicate(l)}
              onRun={(to) => onRun(l, to)}
              onDelete={() => onDelete(l)}
            />
          </div>
        )
      })}
    </section>
  )
}

/** Per-row actions menu (§7.2). */
function LoadoutMenu({
  loadout,
  isActive,
  onSetActive,
  onRename,
  onDuplicate,
  onRun,
  onDelete,
}: {
  loadout: Loadout
  isActive: boolean
  onSetActive: () => void
  onRename: () => void
  onDuplicate: () => void
  onRun: (to: SimTarget) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${loadout.name}`}
          className="text-fg-faint hover:text-fg shrink-0 rounded-md px-1.5 py-1 text-sm transition-colors"
        >
          ⋯
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="bg-surface-overlay border-border-subtle z-50 w-44 overflow-hidden rounded-md border py-1 shadow-lg"
        >
          {!isActive && <MenuItem onClick={act(onSetActive)}>Set active</MenuItem>}
          <MenuItem onClick={act(onRename)}>Rename</MenuItem>
          <MenuItem onClick={act(onDuplicate)}>Duplicate</MenuItem>
          <MenuItem onClick={act(() => onRun('/quick-sim'))}>
            Run Quick Sim
          </MenuItem>
          <MenuItem onClick={act(() => onRun('/gear'))}>Run Top Gear</MenuItem>
          <MenuItem onClick={act(onDelete)} tone="danger">
            Delete
          </MenuItem>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MenuItem({
  onClick,
  tone = 'default',
  children,
}: {
  onClick: () => void
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:bg-surface-raised w-full px-3 py-1.5 text-left text-sm transition-colors ${
        tone === 'danger' ? 'text-danger' : 'text-fg-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

/** Right pane — inspected gear + talents for the selected loadout (read-only P2). */
function LoadoutDetail({
  character,
  loadout,
}: {
  character: Character
  loadout: Loadout
}) {
  const profile = buildProfile(loadout)
  const { character: inspected, status } = useInspectedCharacter(profile)

  // Persist the derived ilvl so cards / switcher can show it without re-inspecting.
  useEffect(() => {
    if (
      status === 'ready' &&
      inspected?.ilvl != null &&
      inspected.ilvl !== loadout.ilvl
    ) {
      void setLoadoutIlvl(character.id, loadout.id, inspected.ilvl)
    }
  }, [status, inspected, loadout.ilvl, loadout.id, character.id])

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row lg:items-start">
      <div className="border-border-subtle bg-surface-raised rounded-lg border p-4 lg:w-80 lg:shrink-0">
        <h2 className="text-fg font-display mb-3 text-sm font-semibold">Gear</h2>
        {status === 'loading' && !inspected ? (
          <p className="text-fg-subtle text-sm">Inspecting…</p>
        ) : inspected ? (
          <GearPanel gear={inspected.gear} />
        ) : (
          <p className="text-fg-muted text-sm">
            Couldn&apos;t read gear from this loadout.
          </p>
        )}
      </div>
      <div className="border-border-subtle bg-surface-raised flex-1 rounded-lg border p-4">
        {inspected ? (
          <TalentPanel talents={inspected.talents} />
        ) : (
          <p className="text-fg-subtle text-sm">…</p>
        )}
      </div>
    </div>
  )
}

function RenameDialog({
  loadout,
  onClose,
  onSave,
}: {
  loadout: Loadout
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(loadout.name)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Rename loadout">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onSave(name)
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface-inset border-border-subtle text-fg focus-visible:border-border rounded-md border px-3 py-2 text-sm outline-none"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  )
}
