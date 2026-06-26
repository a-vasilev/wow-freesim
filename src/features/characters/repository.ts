/**
 * Character library repository (CHARACTER_PERSISTENCE §3/§4). CRUD + `liveQuery`
 * reactivity over the Dexie `characters` table (declared on the shared HistoryDb).
 * Loadouts are nested on the row, so every loadout mutation is a read-modify-write
 * of the owning character inside one transaction.
 */
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '@/features/history/db'
import type { Character, GearOverride, Loadout } from './types'
import type { ParsedIdentity } from './parseIdentity'
import { humanizeToken } from './format'

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// ── reactive reads ───────────────────────────────────────────────────────────

/** Live character list (most-recently-updated first). `undefined` while loading. */
export function useCharacters(): Character[] | undefined {
  const [chars, setChars] = useState<Character[]>()
  useEffect(() => {
    const sub = liveQuery(() =>
      db.characters.orderBy('updatedAt').reverse().toArray(),
    ).subscribe({ next: setChars, error: () => setChars([]) })
    return () => sub.unsubscribe()
  }, [])
  return chars
}

/** Live single character. `null` = not found; `undefined` = loading. */
export function useCharacter(id: string): Character | null | undefined {
  const [char, setChar] = useState<Character | null>()
  useEffect(() => {
    setChar(undefined)
    const sub = liveQuery(() => db.characters.get(id)).subscribe({
      next: (c) => setChar(c ?? null),
      error: () => setChar(null),
    })
    return () => sub.unsubscribe()
  }, [id])
  return char
}

export function getCharacter(id: string): Promise<Character | undefined> {
  return db.characters.get(id)
}

// ── identity matching (§2.2) ─────────────────────────────────────────────────

/**
 * Characters that match a pasted identity by `name` (case-insensitive). When both
 * sides carry a realm they must agree; if either omits it we still suggest the
 * name match (the caller always confirms — we never silently overwrite, §2.2).
 */
export async function findMatches(
  identity: Pick<ParsedIdentity, 'name' | 'realm'>,
): Promise<Character[]> {
  const all = await db.characters.toArray()
  return all.filter((c) => {
    if (!eq(c.identity.name, identity.name)) return false
    if (identity.realm && c.identity.realm)
      return eq(c.identity.realm, identity.realm)
    return true // realm absent on one side → name-only suggestion
  })
}

/** The loadout in a character whose spec matches, if any (for the update branch). */
export function loadoutForSpec(
  character: Character,
  spec: string | undefined,
): Loadout | undefined {
  if (!spec) return undefined
  return character.loadouts.find((l) => eq(l.spec, spec))
}

// ── loadout construction ─────────────────────────────────────────────────────

interface NewLoadout {
  name?: string
  spec: string
  base: string
  edits?: GearOverride[]
  ilvl?: number
}

function makeLoadout(input: NewLoadout, now: number): Loadout {
  return {
    id: crypto.randomUUID(),
    name: input.name?.trim() || humanizeToken(input.spec) || 'Loadout',
    spec: input.spec,
    base: input.base,
    edits: input.edits ?? [],
    ilvl: input.ilvl,
    updatedAt: now,
  }
}

// ── writes ───────────────────────────────────────────────────────────────────

/** Create a new character with one initial loadout. Returns both ids. */
export async function createCharacter(input: {
  identity: { name: string; realm: string | null }
  className: string
  race: string
  loadout: NewLoadout
}): Promise<{ characterId: string; loadoutId: string }> {
  const now = Date.now()
  const loadout = makeLoadout(input.loadout, now)
  const character: Character = {
    id: crypto.randomUUID(),
    identity: input.identity,
    className: input.className,
    race: input.race,
    loadouts: [loadout],
    activeLoadoutId: loadout.id,
    createdAt: now,
    updatedAt: now,
  }
  await db.characters.add(character)
  return { characterId: character.id, loadoutId: loadout.id }
}

/** Add a new loadout to an existing character; makes it the active loadout. */
export async function addLoadout(
  characterId: string,
  loadout: NewLoadout,
): Promise<string> {
  return db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    if (!c) throw new Error('Character not found')
    const now = Date.now()
    const next = makeLoadout(loadout, now)
    await db.characters.put({
      ...c,
      loadouts: [...c.loadouts, next],
      activeLoadoutId: next.id,
      updatedAt: now,
    })
    return next.id
  })
}

/** Patch one loadout in place (used by both update-base and Phase-3 edits). */
async function patchLoadout(
  characterId: string,
  loadoutId: string,
  patch: Partial<Pick<Loadout, 'name' | 'base' | 'edits' | 'ilvl' | 'spec'>>,
): Promise<void> {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    if (!c) return
    const now = Date.now()
    await db.characters.put({
      ...c,
      loadouts: c.loadouts.map((l) =>
        l.id === loadoutId ? { ...l, ...patch, updatedAt: now } : l,
      ),
      updatedAt: now,
    })
  })
}

/** Write a fresh paste back to a loadout (§6.4 "Update [loadout]"). */
export function updateLoadoutBase(
  characterId: string,
  loadoutId: string,
  base: string,
  ilvl?: number,
): Promise<void> {
  return patchLoadout(characterId, loadoutId, { base, ilvl })
}

/** Refresh a loadout's derived display ilvl after an inspect, if it changed. */
export function setLoadoutIlvl(
  characterId: string,
  loadoutId: string,
  ilvl: number,
): Promise<void> {
  return patchLoadout(characterId, loadoutId, { ilvl })
}

export function renameLoadout(
  characterId: string,
  loadoutId: string,
  name: string,
): Promise<void> {
  return patchLoadout(characterId, loadoutId, { name: name.trim() || 'Loadout' })
}

/** Copy a loadout under "<name> copy"; makes the copy active. Returns its id. */
export async function duplicateLoadout(
  characterId: string,
  loadoutId: string,
): Promise<string | undefined> {
  return db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    const src = c?.loadouts.find((l) => l.id === loadoutId)
    if (!c || !src) return undefined
    const now = Date.now()
    const copy: Loadout = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      edits: [...src.edits],
      updatedAt: now,
    }
    await db.characters.put({
      ...c,
      loadouts: [...c.loadouts, copy],
      activeLoadoutId: copy.id,
      updatedAt: now,
    })
    return copy.id
  })
}

/**
 * Remove a loadout. Deleting the last loadout deletes the character (a toon with
 * no builds has nothing to sim). Re-points `activeLoadoutId` if it was removed.
 */
export async function deleteLoadout(
  characterId: string,
  loadoutId: string,
): Promise<void> {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    if (!c) return
    const loadouts = c.loadouts.filter((l) => l.id !== loadoutId)
    if (loadouts.length === 0) {
      await db.characters.delete(characterId)
      return
    }
    const activeLoadoutId =
      c.activeLoadoutId === loadoutId ? loadouts[0].id : c.activeLoadoutId
    await db.characters.put({
      ...c,
      loadouts,
      activeLoadoutId,
      updatedAt: Date.now(),
    })
  })
}

export async function setActiveLoadout(
  characterId: string,
  loadoutId: string,
): Promise<void> {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    if (!c || c.activeLoadoutId === loadoutId) return
    await db.characters.put({ ...c, activeLoadoutId: loadoutId })
  })
}

export function deleteCharacter(id: string): Promise<void> {
  return db.characters.delete(id)
}

// ── display helpers ──────────────────────────────────────────────────────────

/** Highest loadout ilvl, for the card/switcher readout (undefined if none set). */
export function topIlvl(character: Character): number | undefined {
  const ilvls = character.loadouts
    .map((l) => l.ilvl)
    .filter((n): n is number => n != null)
  return ilvls.length ? Math.max(...ilvls) : undefined
}
