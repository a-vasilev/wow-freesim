import { create } from 'zustand'
import {
  DEFAULT_SIM_OPTIONS,
  EngineCancelledError,
  getEngine,
  type ParsedCharacter,
  type ProfilesetReport,
  type Progress,
  type SimOptions,
} from '@/engine'
import { looksLikeProfile } from '@/lib/simcProfile'
import { withThreadPref } from '@/features/sim-options/threads-store'
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

interface GearState {
  phase: GearPhase
  profile: string
  /** Identity for the context bar (from inspect()); model drives Top Gear itself. */
  character: ParsedCharacter | null
  model: GearModel | null
  selection: Selection
  options: SimOptions
  progress: Progress | null
  report: ProfilesetReport | null
  /** Plans for the in-flight / last run — maps result names → changed items. */
  plans: PlannedSet[]
  /** Bag items hidden because this character can't equip them (the picker note). */
  droppedItems: DroppedItem[]
  error: string | null

  setProfile: (profile: string) => void
  setOptions: (options: SimOptions) => void
  toggleCandidate: (slotKey: string, uid: string) => void
  inspect: () => Promise<void>
  run: () => Promise<void>
  cancel: () => void
  edit: () => void
  reset: () => void
}

// Guards against a stale inspect (paste edited again mid-flight) clobbering newer
// state — only the latest inspect's results are applied.
let inspectGen = 0

export const useTopGear = create<GearState>((set, get) => ({
  phase: 'empty',
  profile: '',
  character: null,
  model: null,
  selection: {},
  options: DEFAULT_SIM_OPTIONS,
  progress: null,
  report: null,
  plans: [],
  droppedItems: [],
  error: null,

  setProfile: (profile) => set({ profile }),
  setOptions: (options) => set({ options }),

  toggleCandidate: (slotKey, uid) => {
    const current = get().selection[slotKey] ?? []
    const next = current.includes(uid)
      ? current.filter((u) => u !== uid)
      : [...current, uid]
    set({ selection: { ...get().selection, [slotKey]: next } })
  },

  inspect: async () => {
    const { profile, options } = get()
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
    const { model, options, profile, phase, selection } = get()
    if (phase === 'running' || !model) return

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
        (progress) => set({ progress }),
      )
      set({ report, phase: 'results' })
    } catch (e) {
      if (e instanceof EngineCancelledError) {
        set({ phase: 'ready', progress: null })
      } else {
        set({ phase: 'error', error: messageOf(e) })
      }
    }
  },

  cancel: () => getEngine().cancel(),

  edit: () => set({ phase: get().model ? 'ready' : 'empty' }),

  reset: () =>
    set({
      phase: 'empty',
      profile: '',
      character: null,
      model: null,
      selection: {},
      report: null,
      plans: [],
      droppedItems: [],
      progress: null,
      error: null,
    }),
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
