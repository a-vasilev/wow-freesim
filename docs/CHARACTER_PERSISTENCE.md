# Character Persistence — Phase 3 (in-app editing)

> **Status:** Phases 1 and 2 are **implemented and shipped**. This document has
> been trimmed to describe **only the remaining Phase 3** work (in-app
> theorycraft editing). The Phase 1–2 design detail has been removed now that it
> lives in code; see §1 for what already exists.
>
> **Blocked:** Phase 3's per-slot gear *search* needs the engine `item-index.json`
> bundle, which has **not shipped** (engine is still `v1205.01-2`, wasm + glue
> only). Do not start Phase 3 until that lands — see §6.
>
> All UI reuses the existing *Editorial Noir* design system — see
> [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). No new tokens, no off-token styles.

---

## 1. What already exists (Phases 1–2, done)

The foundation Phase 3 builds on is in place. The relevant pieces:

- **One shared active draft.** `features/session/activeDraftStore.ts` — a
  persisted (`ilvl:active`) `base` + `edits` + `bound` + `dirty` model. Every sim
  tab reads it; editing it anywhere changes it everywhere. `edits` is wired
  through but **always empty until Phase 3**.
- **The `buildProfile` seam.** `features/characters/buildProfile.ts` —
  `buildProfile(loadout)` / `buildProfileFromDraft(draft)` compose
  `base + edits` into final `.simc` text. Today `edits` is empty so it returns
  `base` verbatim. **Every engine call already routes through this**, which is
  exactly why Phase 3 is additive (see §3).
- **Character library + loadouts.** `features/characters/types.ts` (the
  `Character` → `Loadout` → `GearOverride` shapes), `repository.ts` (Dexie
  `characters` table, CRUD incl. `patchLoadout`/`updateLoadoutBase`), and the
  two-step switcher.
- **The detail view.** `features/characters/CharacterDetail.tsx` — the two-pane
  surface (loadouts list + selected-loadout gear/talents) that Phase 3 turns
  editable. It already renders the selected loadout through `buildProfile` and
  reuses `features/character/GearPanel.tsx` + `TalentPanel.tsx`. **Read-only
  today.**
- **The owned-gear model.** `features/gear/gearModel.ts` (`parseGearModel`)
  extracts a per-slot candidate pool — equipped *plus* the bag/bank items the
  simc addon exports — from raw profile text, with **no item catalog**. This is
  the data source for the buildable slice of Phase 3 gear editing (§5).

These are settled and **not** to be re-architected. Phase 3 is purely additive on
top of the `edits[]` → `buildProfile` → save seam.

## 2. Core model (reference)

`features/characters/types.ts` — unchanged in Phase 3, repeated here because the
editing work writes into `Loadout.edits`:

```ts
interface Loadout {
  id: string
  name: string                     // "Arms — Raid", "Fury — M+"
  spec: string                     // e.g. "arms"
  base: string                     // imported simc paste (talents, APL, gear snapshot)
  edits: GearOverride[]            // in-app structural changes — POPULATED in Phase 3
  ilvl?: number
  updatedAt: number
}

// One `slot=item,id=…,bonus_id=…,gem_id=…,enchant_id=…` fragment per changed slot —
// the same shape Top Gear produces in features/gear/profilesets.ts.
interface GearOverride {
  slot: string                     // simc slot key: head, finger1, trinket2, …
  fragment: string                 // the raw simc override line
}
```

A loadout that has diverged from its original paste is exactly
`base` (the import) **plus** `edits[]` (the in-app changes). `buildProfile`
collapses the two; simc applies later lines over earlier ones, so each override
supersedes the imported slot.

## 3. The `buildProfile` seam — already the integration point

Phase 3 needs **no new plumbing**. `buildProfile` already composes `base + edits`
and every run/inspect path already calls it. The Phase 3 work is only:

1. Give the detail view affordances that push `GearOverride`s into the selected
   loadout's `edits[]` (and the active draft's `edits`, via
   `useActiveDraft.setEdits`, which already marks the draft `dirty` when bound).
2. Re-render the right pane through `buildProfile` so edits show immediately.
3. A **"Save changes"** action that persists `edits` back to the loadout
   (`repository.patchLoadout` already accepts an `edits` patch).

No engine, store, or schema changes. The seam was introduced in Phase 1
specifically so this stays additive.

## 4. Phase 3 UI — the detail view becomes editable

Surface: `features/characters/CharacterDetail.tsx` (§7.2 of the original design).
Layout, tokens, and the GearPanel/TalentPanel reuse are unchanged — they gain
editing affordances.

- **Per-slot gear edit.** Each slot tile (`features/character/SlotTile.tsx` /
  `ItemCell`) gains an edit/swap affordance. Selecting a replacement writes a
  `GearOverride` for that slot into the loadout's `edits[]`; clearing it removes
  the override (slot reverts to the imported item). Item display stays
  Wowhead-driven by id (game-constant quality colors, never re-themed).
- **Talents.** Become editable once the talent-tree bundle is available; until
  then `TalentPanel` stays on the read-only §6.5 fallback.
- **Save / discard.** Edits live in the active draft (so they preview live and
  mark the bound loadout `dirty`). A primary **"Save changes"** button (§8.3)
  persists `edits` to the loadout; the existing dirty-switch guard
  (`useDirtyGuard`) already warns before navigating away with unsaved edits.

## 5. Buildable now vs. blocked

Phase 3 gear editing has two sources; only one needs the unshipped index.

| Slice | Data needed | Status |
|---|---|---|
| **Swap to an item I already own** | none — uses `parseGearModel`'s bag/bank pool | **buildable now** |
| **Add an arbitrary item I don't own** (search picker) | `item-index.json` | **blocked** (§6) |

The owned-pool swap is "Gear 2a applied to single-slot editing": it produces a
real `GearOverride` and flows through the same `buildProfile`/save seam, so the
arbitrary-item search drops in **additively** later with no re-architecture.

## 6. Blocker — `item-index.json`

The "add an item I don't own" picker (WEB_UI_PLAN "Gear 2b") is Fuse.js search
over the engine `item-index.json` search list (id / name / slot / ilvl / quality
/ icon-name / valid bonus options). That bundle is **not** in the shipped engine
release (`v1205.01-2` is wasm + glue only — see WEB_UI_PLAN §3.1/§10). Until a
release attaches it, the arbitrary-item slice cannot be built as specced.

**Decision pending:** whether to build the owned-pool swap slice (§5) now and
layer search on later, or wait for the index and build the full picker in one go.
Do not start Phase 3 implementation until this is resolved.

## 7. Residual caveats

- **Token discipline:** every surface resolves through semantic tokens; no
  arbitrary values, no inline `style` outside the design-system allowlist.
  Quality/tooltip tokens are game constants and are never re-themed.
- **Tooltips & keyboard:** the detail view inherits the Wowhead-tooltip keyboard
  caveat (design system §10) — item stats stay visible in the tile itself, not
  tooltip-only.
- **History stamping (optional, additive):** runs may later be stamped with
  `characterId` + `loadoutId` so History can filter by character. Not required
  for Phase 3.
