# Character Persistence & Input Memory — Design

> **Status:** Approved design, not yet implemented. This document is the plan;
> no code has been written against it. Built in phases (see §9).
>
> **Scope:** How the app remembers a user's simc input across sessions and tabs,
> and introduces a first-class **Character** library with multiple **Loadouts**
> that any sim (Quick Sim, Top Gear, future) can run against. All UI here reuses
> the existing *Editorial Noir* design system — see
> [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). No new tokens, no off-token styles.

---

## 1. Problem

Today every sim tab holds its own in-memory `profile` string
(`features/quick-sim/store.ts`, `features/gear/store.ts`), neither persisted.
Consequences:

- Opening Quick Sim always shows an **empty input**; the last paste is lost on
  reload or navigation.
- The string pasted in Quick Sim does **not** flow to Top Gear (or anywhere
  else) — you re-paste per tab.
- There is **no concept of "my character."** You can't keep a roster, update a
  toon as it gears up, keep multiple builds, or run any sim against a saved
  config.

What *is* already persisted (for reference): thread preference
(`ilvl:threads`), theme (`ilvl:theme`), sidebar (`ilvl:sidebar`), and run
**history** (Dexie `ilvl-history`, `runs` + `payloads` tables).

## 2. Decisions (locked)

These were resolved with the product owner and are not open for re-litigation
during implementation:

1. **One shared active profile.** Every sim tab operates on a single "current
   working profile." Editing it in any tab changes it everywhere. This is what
   makes the Quick-Sim → Top-Gear auto-populate fall out for free.
2. **Identity = name + realm.** On import we match the pasted character against
   the library by `name + realm`. *Caveat:* the `/simc` addon paste does **not
   always** include `server=`/`region=` (the bundled sample fixture has
   neither). When realm is absent we fall back to **name-only matching as a
   suggestion** and always show a confirm prompt — we **never silently
   overwrite**.
3. **A character owns multiple loadouts.** A character is the *toon*
   (name + realm + class + race). Spec variants (Arms vs Fury), "Raid build" vs
   "M+ build", or "last week's gear" are **loadouts inside one character**. You
   **sim by picking a character + a loadout.**
4. **Global default fight settings.** One remembered `SimOptions` set, persisted
   across sessions, overridable per run. (Threads keep their own existing store.)
5. **No per-character draft.** There is exactly one active draft. Switching
   character/loadout while the draft has unsaved edits shows a **discard
   warning** — we do not keep a separate in-progress draft per character.
6. **Active-character switcher is two-step:** pick character, then pick loadout.
7. **Cold-start seeding:** if nothing is active, show the **last-used simc
   string**; if there is none, show an **empty input**. (The unbound active
   draft *is* that last-used string, so this is automatic.)
8. **A character is more than a string.** Its source today is the imported simc
   paste (which carries talents, APL, and a gear snapshot), but the model must
   support **manual structural edits later** (add/swap gear via item search,
   edit talents) and still run sims. A character can therefore *diverge* from
   its original paste. See §5 (the `buildProfile` seam) and §7 (detail view).

## 3. Core model

Three distinct concepts. Today (1) and (2) are conflated into per-tab `profile`
strings; (3) already exists.

| Concept | What it is | Lifetime |
|---|---|---|
| **Active draft** | The one working profile every tab edits right now | Persists across reloads; exactly one |
| **Character → Loadout** | A saved toon and its named buildable configs | Forever, until deleted |
| **Run** (existing History) | An immutable snapshot of one sim result | Append-only log |

The active draft is either **bound** to a specific loadout (editing it makes
that loadout "dirty") or **unbound** (a scratch paste = the last-used string).

### 3.1 Data shapes

```ts
// features/characters/types.ts (new)

interface Character {
  id: string                       // uuid
  identity: { name: string; realm: string | null }  // match key (§2.2)
  className: string                // stable across loadouts (e.g. "warrior")
  race: string
  loadouts: Loadout[]
  activeLoadoutId: string          // last-used loadout for this character
  createdAt: number
  updatedAt: number
}

interface Loadout {
  id: string                       // uuid
  name: string                     // user label: "Arms — Raid", "Fury — M+"
  spec: string                     // e.g. "arms"
  base: string                     // imported simc paste (talents, APL, gear snapshot)
  edits: GearOverride[]            // in-app structural changes; EMPTY in Phase 1–2
  ilvl?: number                    // derived from last inspect, for display
  updatedAt: number
}

// Same shape Top Gear already produces in features/gear/profilesets.ts —
// one `slot=item,id=…,bonus_id=…,gem_id=…,enchant_id=…` fragment per changed slot.
interface GearOverride {
  slot: string                     // simc slot key: head, finger1, trinket2, …
  fragment: string                 // the raw simc override line
}
```

Loadouts are stored **nested on the character row** — they're small, always
loaded together, and never queried independently. No separate Dexie table.

## 4. Storage layout

| Data | Where | Key / table | Why |
|---|---|---|---|
| Active draft (`base`, `edits`, `bound`, `dirty`) | zustand + `persist` | `ilvl:active` | Small, synchronous, must survive reload |
| Global sim options | zustand + `persist` | `ilvl:sim-options` | Same pattern as existing `ilvl:threads` |
| Character library | Dexie | `characters` table (version-bump the existing `ilvl-history` DB) | Grows over time; holds raw strings + future structural gear; `liveQuery` reactivity; consistent with History |
| Run history | Dexie | existing `runs` / `payloads` | Unchanged |

Threads, theme, sidebar stores stay exactly as they are. The Dexie change is a
`this.version(2).stores({ characters: 'id, updatedAt' })` migration on the
existing `HistoryDb` (`features/history/db.ts`) — additive, no data loss.

## 5. State architecture

### 5.1 New stores

```ts
// features/session/activeDraftStore.ts (new) — persisted, localStorage ilvl:active
interface ActiveDraftState {
  base: string
  edits: GearOverride[]
  bound: { characterId: string; loadoutId: string } | null
  dirty: boolean                   // base/edits differ from the bound loadout
  setBase(base: string): void      // marks dirty when bound
  bind(characterId: string, loadoutId: string): void   // loads loadout → draft
  unbind(): void
  clear(): void
}

// features/sim-options/simOptionsStore.ts (new) — persisted, localStorage ilvl:sim-options
interface SimOptionsState {
  options: SimOptions              // minus `threads` (kept in threads-store)
  setOptions(o: SimOptions): void
}
```

### 5.2 Refactor of existing sim stores

`features/quick-sim/store.ts` and `features/gear/store.ts`:

- **Remove** their local `profile` and `options`.
- **Read** the working string from `useActiveDraft` (via `buildProfile`, §5.3)
  and fight settings from `useSimOptions`.
- **Keep** everything tab-local: phase machine, `report` / `results`,
  `progress`, gear `selection`, `model`. These must not bleed across tabs.

This refactor is what delivers the "shared active profile" behavior — both tabs
now read the same source.

### 5.3 The `buildProfile` seam — the key future-proofing move

Every engine call routes through one function:

```ts
// features/characters/buildProfile.ts (new)
function buildProfile(loadout: Pick<Loadout, 'base' | 'edits'>): string
function buildProfileFromDraft(draft: ActiveDraftState): string
```

- **Phase 1–2:** `edits` is always empty, so this returns `base` verbatim —
  identity function, trivial, zero behavior change.
- **Phase 3:** the item-search feature pushes `GearOverride`s into `edits`;
  `buildProfile` composes `base + edits` into the final simc text. Because the
  engine seam (`SimEngine.inspect` / `.run` / `.runProfilesets`) is already
  string-based and every run path already goes through `buildProfile`, the
  theorycraft feature becomes **purely additive** — no downstream plumbing
  changes.

Introducing this indirection in Phase 1 (when it's free) is what avoids a
painful refactor in Phase 3.

### 5.4 Identity parsing (client-side, no engine)

```ts
// features/characters/parseIdentity.ts (new)
interface ParsedIdentity {
  name: string; className: string; spec?: string; race?: string
  realm: string | null; region: string | null
}
function parseIdentity(simc: string): ParsedIdentity | null
```

Reads the first lines of the paste — line 1 is `class="Name"` (e.g.
`warrior="Throgar"`), followed by `spec=`, `race=`, `level=`, and `server=` /
`region=` **if present**. This is cheap and does not require an engine
`inspect()` call, so the import/match UX is instant. Reuses/extends the existing
`looksLikeProfile` heuristic in `lib/simcProfile.ts`.

## 6. User flows

### 6.1 First paste (unbound)
1. Paste into Quick Sim → stored as active draft `base`, `dirty=false`, unbound.
2. Inspect runs as today; character preview shows.
3. A subtle **"Save as character"** affordance appears (ghost button, §8.4).
   Optional — the user can just run.
4. Switch to Top Gear → the same string is already there (shared draft). ✅

### 6.2 Save / auto-match
- On save (or detected on inspect), `parseIdentity` yields `name + realm`:
  - **Match found, same spec as an existing loadout:**
    `Update “Arms — Raid”?` / `Add as new loadout` / `Save as new character`.
  - **Match found, new spec:** `Throgar already saved. Add Fury as a new
    loadout?` / `Update existing loadout…` / `Save as new character`.
  - **No match:** `Save as new character` with name pre-filled from the paste.
- Confirm prompts are a Radix `<Dialog>` (focus-trapped, §10). We never
  auto-overwrite — see §2.2.

### 6.3 Returning later
- App restores the last active draft automatically (no empty box).
- Or pick from the **switcher** (§7.1) → loads that loadout's
  `buildProfile()` output into the draft and binds it.

### 6.4 Updating a character over time
- Paste a fresh export for a bound loadout → draft goes `dirty` → **"Update
  [loadout]"** writes the new `base` back to that loadout.

### 6.5 Running against any character
- From the Characters detail page (§7.2), each loadout row has **Run Quick
  Sim** / **Run Top Gear** — sets it active and navigates. Same engine input
  regardless of tab.

### 6.6 Switching while dirty
- Picking a different character/loadout while `dirty` → Radix `<Dialog>`:
  **"You have unsaved changes. Discard / Cancel."** No per-character draft is
  kept (§2.5).

## 7. UI surfaces

All components below are specified against existing *Editorial Noir* tokens and
component recipes. **No new tokens.** WoW quality colors and item icons follow
the game-constant rules (§3, §7 of the design system).

### 7.1 Active-character switcher (two-step)

Lives in the **in-content header strip** (design system §6 — the 52px sticky
strip, `bg-surface-raised`, bottom `border-border-subtle`), on the left next to
the section title. Present on every sim tab; it is the shared anchor that makes
the one-profile model legible.

**Trigger** (a ghost-button-style control, §8.4 styling — `border-border`,
`text-fg-muted`, `rounded-md`, hover → `border-accent` / `text-accent` /
`bg-accent-subtle`):

```
┌──────────────────────────────────────────────┐
│ ●  Throgar · Stormrage  —  Arms — Raid     ▾ │
└──────────────────────────────────────────────┘
  └ dirty dot: 5px, bg-accent (only when draft is dirty)
     name: text-sm font-sans text-fg
     "·realm": text-fg-muted    loadout: text-fg-muted
     chevron: 13px line icon, currentColor (§7 affordance icon)
```

**Two-step menu** — Radix popover/menu on `bg-surface-overlay`, 1px
`border-border-subtle`, `rounded-md`, `shadow-lg`:

- **Step 1 — Characters:** one row per character. Class name in its WoW class
  feel is conveyed by the item-quality-neutral palette (we do **not** invent a
  class-color token — name in `text-fg`, spec count + top ilvl in
  `text-fg-muted`, `tabular-nums`). Active row uses `bg-accent-subtle` +
  the 2px `bg-accent` left marker (the nav-item active recipe, §8.1). A
  trailing chevron drills into step 2.
- **Step 2 — Loadouts** for the chosen character: one row per loadout — loadout
  name (`text-sm`), spec + ilvl (`text-xs text-fg-muted tabular-nums`). The
  character's `activeLoadoutId` is pre-highlighted. Selecting binds the draft.
- A persistent footer row: **"Unsaved paste"** (selects the unbound draft) and
  **"Manage characters →"** (routes to `/characters`).

Transitions per design system §5 (`background 0.12s`). No spring/elaborate
motion.

### 7.2 Characters library + detail (new route `/characters`)

New **sidebar nav item** (design system §8.1 nav-item anatomy: 16×16 line icon,
`text-sm` label, active = `bg-accent-subtle` + 2px accent left bar). Icon: a
simple roster/people line glyph in the §7 affordance-icon style.

**`/characters` (index)** — page composition follows the report/gear shell
(sidebar + 52px header strip + content). Content is a grid of **character
cards**:

```
┌─ character card — bg-surface-raised, border-border-subtle, rounded-lg ──┐
│  Throgar                                          Stormrage             │
│  text-2xl font-display                            text-sm text-fg-muted │
│  Warrior · 2 loadouts · top ilvl 639              text-sm text-fg-muted │
│  ─────────────────────────────────────────────── border-border-subtle  │
│  [ SET ACTIVE ]   [ RUN ]            updated 2d ago                     │
│   ghost btn §8.4   primary §8.3      text-xs text-fg-faint              │
└─────────────────────────────────────────────────────────────────────────┘
```

Card padding 12–16px (design system §5). Hover lift via `shadow-sm`. Clicking
the card body opens the detail view.

**`/characters/$id` (detail)** — **this is the surface that evolves into
editing.** Layout reuses the gear screen's two-pane composition (design system
§6: `grid-template-columns: 310px 1fr; gap: 20px`, both panels
`bg-surface-raised border-border-subtle rounded-lg`).

```
┌─ header strip (52px) ─ Characters › Throgar ─────── [chips] [Run ▾] ─────┐
├─ character context bar ──────────────────────────────────────────────────┤
│  Throgar · Stormrage          Warrior            [ + Add loadout ]        │
│  text-3xl font-display        text-fg-muted       ghost btn §8.4          │
├─ Loadouts (left, 310px) ──────┬─ Loadout detail (right, flex) ───────────┤
│  ◦ Arms — Raid    ilvl 639    │  GEAR (reuse GearPanel / slot tiles §8.6) │
│  ◦ Fury — M+      ilvl 636    │   ┌──────┐ each slot tile:                │
│    each = slot-tile-like row, │   │ icon │ 34×34 item icon §7,            │
│    active = bg-accent-subtle  │   └──────┘ quality border + left stripe   │
│    + 2px accent left bar      │   slot label text-xs text-fg-faint;       │
│                               │   item name quality-colored               │
│  per-row actions (hover/menu):│  ─────────────────────────────────────── │
│   Set active · Rename ·       │  TALENTS (reuse TalentPanel)              │
│   Duplicate · Run QS · Run TG │   loadout string / nodes (read-only P2)   │
│   · Delete                    │                                           │
└───────────────────────────────┴───────────────────────────────────────────┘
```

- Left "Loadouts" list rows borrow the **slot-tile** visual (§8.6): default
  `bg-surface-inset` / `border-border-subtle`; selected `bg-accent-subtle` /
  `border-accent` + accent left stripe.
- Right pane reuses the **existing** `features/character/GearPanel.tsx` and
  `TalentPanel.tsx` — same slot tiles (§8.6), same Wowhead item tooltips (§8.8),
  same item icons (§7). No bespoke gear rendering.
- Item names use **WoW quality color tokens** (`text-quality-epic`, etc.) —
  game constants, never re-themed (§3).
- **Read-only in Phase 2.** In **Phase 3**, each slot tile gains an
  edit/swap-via-search affordance and talents become editable; edits write to
  the loadout's `edits[]`, re-render through `buildProfile`, and **"Save
  changes"** (primary button §8.3) persists. The view is built around the
  loadout model from day one, so editing is additive.
- The header **"Run ▾"** is a small split/menu primary button (§8.3): runs the
  active loadout, with a menu to pick Quick Sim vs Top Gear.

### 7.3 Compose body (existing, lightly extended)
`features/quick-sim/ComposeBody.tsx` / `AdvancedBody.tsx` and the gear compose
body keep their textarea/CodeMirror (design system: `.simc` input is
`font-mono text-sm`, `bg-surface-inset`). They now bind to the shared draft and
gain the contextual **Save / Update** affordances (ghost + primary buttons,
§8.3–8.4) described in §6.2/§6.4.

### 7.4 Global sim-options chips (existing)
`features/sim-options/SimOptionChips.tsx` continues to render the header-strip
setting chips (design system §6 / §8.2 — `rounded-full`, `bg-surface-overlay`,
1px `border-border-subtle`, `tabular-nums`), now reading/writing the persisted
`useSimOptions` store. A change persists as the global default.

## 8. Relationship to History (small, additive)
Optionally stamp each saved run with `characterId` + `loadoutId` (new optional
columns on `runs`) so History can filter "Throgar's runs." Not required for the
first cut; the column is cheap to add when the library lands.

## 9. Phasing

- **Phase 1 — input memory (small, no library).**
  - `useActiveDraft` + `useSimOptions` stores (persisted).
  - Refactor Quick Sim + Top Gear to read them.
  - Introduce `buildProfile` as the identity seam.
  - **Outcome:** last input is remembered across reloads; Quick Sim ↔ Top Gear
    auto-populate. Cold-start seeding (§2.7) works.
- **Phase 2 — character library + loadouts + detail view (read-only).**
  - Dexie `characters` table (version-2 migration); `parseIdentity`.
  - Two-step switcher in the header strip.
  - `/characters` index + `/characters/$id` detail reusing `GearPanel` /
    `TalentPanel`.
  - Save / update / add-loadout / auto-match flow; dirty-switch warning.
- **Phase 3 — in-app editing (theorycraft).**
  - Per-slot gear search + talent edits writing to `loadout.edits[]`.
  - `buildProfile` composes `base + edits`; "Save changes" persists.
  - **No re-architecture** — purely additive on top of the §5.3 seam.

## 10. Notes / residual caveats
- **Realm absent in paste:** degrade to name-only match *suggestion* + confirm
  prompt; never silent overwrite (§2.2). If realm collisions prove common, a
  later enhancement could ask the user to tag a realm on save.
- **Tooltips & keyboard:** the detail view inherits the Wowhead-tooltip
  keyboard caveat (design system §10) — item stats remain visible in the tile
  itself, not tooltip-only.
- **Token discipline:** every surface above resolves through semantic tokens;
  no arbitrary values, no inline `style` outside the design-system allowlist
  (design system §11). Quality/tooltip tokens are game constants and are never
  re-themed.
