/**
 * Local run history (WEB_UI_PLAN U5) — Dexie/IndexedDB, entirely client-side (no
 * backend). Split into two tables: a light `runs` meta row (what the list needs,
 * cheap to query) and a heavier `payloads` row (full SimReport + the source
 * profile/options, loaded only on reopen). This keeps the list query from pulling
 * every report into memory.
 */
import Dexie, { liveQuery, type Table } from 'dexie'
import { useEffect, useState } from 'react'
import type { SimOptions, SimReport } from '@/engine'
import type { Character } from '@/features/characters/types'

/** The indexed summary surfaced in the history list. */
export interface HistoryRunMeta {
  id: string
  /** epoch ms — the list sorts on this (newest first). */
  createdAt: number
  characterName: string
  specialization: string
  /** mean DPS, for the list readout. */
  dps: number
  iterations: number
  fightStyle?: string
  targets?: number
  fightLength?: number
}

/** The full record needed to reopen / re-run a saved sim. */
export interface HistoryRunPayload {
  id: string
  report: SimReport
  profile: string
  options: SimOptions
}

class HistoryDb extends Dexie {
  runs!: Table<HistoryRunMeta, string>
  payloads!: Table<HistoryRunPayload, string>
  /**
   * Character library (CHARACTER_PERSISTENCE §4). Loadouts are stored nested on
   * the row (small, always loaded together), so only `id`/`updatedAt` are indexed.
   */
  characters!: Table<Character, string>

  constructor() {
    super('ilvl-history')
    this.version(1).stores({
      // Only indexed fields are listed; the rest are stored unindexed.
      runs: 'id, createdAt',
      payloads: 'id',
    })
    // v2 — additive: adds the characters table, no change to runs/payloads (no
    // data loss). Dexie carries existing rows forward untouched.
    this.version(2).stores({
      characters: 'id, updatedAt',
    })
  }
}

export const db = new HistoryDb()

/** Persist a finished report; returns the new run's stable id (the deep link). */
export async function saveRun(
  report: SimReport,
  profile: string,
  options: SimOptions,
): Promise<string> {
  const id = crypto.randomUUID()
  const meta: HistoryRunMeta = {
    id,
    createdAt: Date.now(),
    characterName: report.character.name,
    specialization: report.character.specialization,
    dps: report.dps.mean,
    iterations: report.meta.iterations,
    fightStyle: report.meta.fightStyle,
    targets: report.meta.targets,
    fightLength: report.meta.fightLength,
  }
  await db.transaction('rw', db.runs, db.payloads, async () => {
    await db.runs.add(meta)
    await db.payloads.add({ id, report, profile, options })
  })
  return id
}

export async function deleteRun(id: string): Promise<void> {
  await db.transaction('rw', db.runs, db.payloads, async () => {
    await db.runs.delete(id)
    await db.payloads.delete(id)
  })
}

export function getRunPayload(
  id: string,
): Promise<HistoryRunPayload | undefined> {
  return db.payloads.get(id)
}

/** Live history list (newest first). `undefined` while loading. */
export function useHistoryRuns(): HistoryRunMeta[] | undefined {
  const [runs, setRuns] = useState<HistoryRunMeta[]>()
  useEffect(() => {
    const sub = liveQuery(() =>
      db.runs.orderBy('createdAt').reverse().toArray(),
    ).subscribe({ next: setRuns, error: () => setRuns([]) })
    return () => sub.unsubscribe()
  }, [])
  return runs
}

/** Live single-payload fetch by id. `null` = not found; `undefined` = loading. */
export function useRunPayload(
  id: string,
): HistoryRunPayload | null | undefined {
  const [payload, setPayload] = useState<HistoryRunPayload | null>()
  useEffect(() => {
    let alive = true
    setPayload(undefined)
    getRunPayload(id).then(
      (p) => alive && setPayload(p ?? null),
      () => alive && setPayload(null),
    )
    return () => {
      alive = false
    }
  }, [id])
  return payload
}
