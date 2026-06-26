import { create } from 'zustand'
import {
  EngineCancelledError,
  getEngine,
  type ParsedCharacter,
  type ProfilesetReport,
  type Progress,
} from '@/engine'
import { looksLikeProfile } from '@/lib/simcProfile'
import { withThreadPref } from '@/features/sim-options/threads-store'
import { useSimOptions } from '@/features/sim-options/simOptionsStore'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { buildProfileFromDraft } from '@/features/characters/buildProfile'
import {
  MAX_COMBOS,
  comboCount,
  defaultSelection,
  generateCombos,
  type Selection,
} from './combos'
import { parseGearModel, type GearModel } from './gearModel'
import { classIdFromProfile, isUsable } from './itemRules'
import { planProfilesets, type PlannedSet } from './profilesets'
import { fetchItemClassInfos } from './wowheadItem'

/** Run-state machine for Top Gear (mirrors Quick Sim's, WEB_UI_PLAN §6/§7). */
export type GearPhase =
  | 'empty'
  | 'inspecting'
  | 'ready'
  | 'running'
  | 'results'
  | 'error'

/** A bag/bank item this character can't equip — hidden from the picker. */
export interface DroppedItem {
  uid: string
  label: string
  name?: string
}

/**
 * Tab-local Top Gear state ONLY. The working profile and fight settings live in
 * the shared stores (`useActiveDraft` + `useSimOptions`, CHARACTER_PERSISTENCE
 * §5.2) — so a paste in Quick Sim is already here. The gear model, selection,
 * report and plans below are per-tab and must not bleed across tabs.
 */
interface GearState {
  phase: GearPhase
  /** Identity for the context bar (from inspect()); model drives Top Gear itself. */
  character: ParsedCharacter | null
  model: GearModel | null
  selection: Selection
  progress: Progress | null
  report: ProfilesetReport | null
  /** Plans for the in-flight / last run — maps result names → changed items. */
  plans: PlannedSet[]
  /** Bag items hidden because this character can't equip them (the picker note). */
  droppedItems: DroppedItem[]
  error: string | null

  toggleCandidate: (slotKey: string, uid: string) => void
  inspect: () => Promise<void>
  run: () => Promise<void>
  cancel: () => void
  edit: () => void
  reset: () => void
}

/** The shared working profile, composed through the `buildProfile` seam (§5.3). */
function currentProfile(): string {
  return buildProfileFromDraft(useActiveDraft.getState())
}

// Guards against a stale inspect (paste edited again mid-flight) clobbering newer
// state — only the latest inspect's results are applied.
let inspectGen = 0

// Same guard for runs: a superseded run (cancelled, or replaced by reset/edit)
// must not write its late progress/report/catch over newer state.
let runGen = 0

export const useTopGear = create<GearState>((set, get) => ({
  phase: 'empty',
  character: null,
  model: null,
  selection: {},
  progress: null,
  report: null,
  plans: [],
  droppedItems: [],
  error: null,

  toggleCandidate: (slotKey, uid) => {
    const current = get().selection[slotKey] ?? []
    const next = current.includes(uid)
      ? current.filter((u) => u !== uid)
      : [...current, uid]
    set({ selection: { ...get().selection, [slotKey]: next } })
  },

  inspect: async () => {
    // Don't let an auto-inspect interrupt a live run: both share the single-worker
    // engine, so inspecting mid-run would supersede (kill) the run.
    if (get().phase === 'running') return
    const profile = currentProfile()
    const options = useSimOptions.getState().options
    if (!looksLikeProfile(profile)) return
    const model = parseGearModel(profile)
    if (!model.slots.length) {
      set({
        phase: get().model ? 'ready' : 'empty',
        error: 'No gear found in this profile — check the /simc paste.',
      })
      return
    }

    const gen = ++inspectGen
    set({ phase: 'inspecting', error: null, droppedItems: [] })

    // Identity (engine, optional) and bag/bank validation (Wowhead) run in PARALLEL,
    // so filtering costs no extra latency over the existing identity inspect. The
    // SimC addon dumps the whole bag regardless of class, so we hide anything this
    // character can't equip BEFORE it's pickable (no run-time surprise).
    const classId = classIdFromProfile(profile)
    const [character, dropped] = await Promise.all([
      getEngine()
        .inspect({ profile, options })
        .catch(() => null),
      validateBagItems(model, classId),
    ])
    if (gen !== inspectGen) return // superseded by a newer paste

    const bad = new Set(dropped.map((d) => d.uid))
    const filtered = filterModelCandidates(model, bad)
    set({
      character,
      model: filtered,
      selection: defaultSelection(filtered),
      droppedItems: dropped,
      phase: 'ready',
    })
  },

  run: async () => {
    const { model, phase, selection } = get()
    if (phase === 'running' || !model) return
    const profile = currentProfile()
    const options = useSimOptions.getState().options

    if (comboCount(model, selection) > MAX_COMBOS) {
      set({
        phase: 'error',
        error: `Too many combinations. Reduce your selections to ${MAX_COMBOS} or fewer.`,
      })
      return
    }
    const plans = planProfilesets(model, generateCombos(model, selection))
    if (plans.length === 0) {
      set({
        phase: 'error',
        error:
          'No gear changes selected — add at least one alternative item to a slot, then run.',
      })
      return
    }

    const gen = ++runGen
    set({ phase: 'running', error: null, report: null, progress: null, plans })
    try {
      const report = await getEngine().runProfilesets(
        {
          profile,
          options: withThreadPref(options),
          profilesets: plans.map((p) => ({
            name: p.name,
            overrides: p.overrides,
          })),
        },
        (progress) => {
          if (gen === runGen) set({ progress })
        },
      )
      if (gen !== runGen) return // superseded by reset/edit/another run
      set({ report, phase: 'results' })
    } catch (e) {
      if (gen !== runGen) return // a newer state owns the store; don't clobber it
      if (e instanceof EngineCancelledError) {
        set({ phase: 'ready', progress: null })
      } else {
        set({ phase: 'error', error: messageOf(e) })
      }
    }
  },

  cancel: () => getEngine().cancel(),

  edit: () => {
    // Leaving the results view drops any in-flight run so it can't settle back over us.
    runGen++
    getEngine().cancel()
    set({ phase: get().model ? 'ready' : 'empty' })
  },

  // Tab-local reset only — the shared draft (the working profile) is left intact.
  reset: () => {
    runGen++
    getEngine().cancel()
    set({
      phase: 'empty',
      character: null,
      model: null,
      selection: {},
      report: null,
      plans: [],
      droppedItems: [],
      progress: null,
      error: null,
    })
  },
}))

// ── bag/bank validation (Wowhead-driven) ─────────────────────────────────────

/**
 * Hide bag/bank items this character can't equip. Equipped items are valid by
 * definition (they're worn), so we only check bag-sourced candidates: look up each
 * one's class/subclass + class restriction from Wowhead (parallel, cached) and
 * apply the armor/class rules. Fails OPEN — anything we can't read stays visible.
 */
async function validateBagItems(
  model: GearModel,
  classId: number | undefined,
): Promise<DroppedItem[]> {
  const bag = new Map<
    string,
    {
      slot: string
      label: string
      name?: string
      itemId: number
      bonusIds: number[]
    }
  >()
  for (const slot of model.slots) {
    for (const c of slot.candidates) {
      if (c.source !== 'bags' || bag.has(c.uid)) continue
      bag.set(c.uid, {
        slot: slot.key,
        label: slot.label,
        name: c.item.name,
        itemId: c.item.itemId,
        bonusIds: c.item.bonusIds,
      })
    }
  }
  if (!bag.size) return []

  const entries = [...bag.entries()]
  const infos = await fetchItemClassInfos(entries.map(([, v]) => v))
  const dropped: DroppedItem[] = []
  for (const [uid, v] of entries) {
    if (!isUsable(classId, v.slot, infos.get(v.itemId) ?? null)) {
      dropped.push({ uid, label: v.label, name: v.name })
    }
  }
  return dropped
}

/** Remove the given candidate uids from every slot's pool. */
function filterModelCandidates(model: GearModel, bad: Set<string>): GearModel {
  if (!bad.size) return model
  return {
    slots: model.slots.map((s) => ({
      ...s,
      candidates: s.candidates.filter((c) => !bad.has(c.uid)),
    })),
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
