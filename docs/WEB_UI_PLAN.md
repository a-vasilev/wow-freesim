# Web UI Implementation Plan (`web` repo) — v0.2

Companion to [`OVERALL_PLAN.md`](./OVERALL_PLAN.md). That document settles the
product, architecture, and engine strategy. This one details **how the web UI is
built**: technologies, theming, the engine abstraction, and the phased build
order.

The architecture in `OVERALL_PLAN.md` is treated as settled and is **not**
relitigated here (React + TS + Vite, Comlink-over-Web-Worker to a threaded
`simc.wasm`, MEMFS/`json2` I/O, Dexie history, Fuse.js search, Cloudflare Pages).

**What changed since v0.1.** Two things landed that this revision folds in:

1. **The design landed — "Editorial Noir".** The visual system is no longer a
   late-binding placeholder. Tokens, typography, the app shell, and component
   specs are settled in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) + `src/theme/`,
   with reference mockups in `docs/mockups/` (`gear.html`, `report.html`). New UI
   is built against those tokens, not ad-hoc styles.
2. **Phase U0 shipped** (foundation + theming spine). The next milestone is the
   **Quick Sim** feature, now specified concretely in §6.

---

## 0. Guiding principles

1. **Tokens or nothing.** No raw color/spacing/font/radius value ever appears in
   a component. Every visual value resolves through a *semantic design token*. A
   theme change = swapping one token map, touching zero component files. This is
   enforced mechanically (lint + a deliberately stripped Tailwind palette), not by
   discipline. Full rationale + enforcement: `DESIGN_SYSTEM.md` §11.
2. **The engine is behind a seam.** All UI work targets a typed `SimEngine`
   interface with a **mock implementation**. The real `simc.wasm` is just another
   implementation of that interface, dropped in later. Nothing in the UI imports
   wasm directly. This is how we develop in full parallel with the fork **without
   depending on it yet**.
3. **Build against the shipped design.** "Editorial Noir" is the approved look.
   The token system, app shell, and component specs are authoritative; build new
   UI against them. The only screens without a mockup are the Quick Sim **compose**
   and **progress** screens (§6) — those are specified here against the same
   tokens.

---

## 1. UI-layer tech stack

Additions/specifics on top of what `OVERALL_PLAN.md` already settles.

| Concern | Choice | Note |
|---|---|---|
| Build/app | Vite + React 19 + TypeScript | from the overall plan |
| Styling | **Tailwind CSS v4** (CSS-first `@theme`) | token-driven, default palette stripped |
| Component behavior | **Radix UI primitives** (+ React Aria where Radix lacks one) | headless, a11y handled, we style 100% |
| Class tooling | `prettier-plugin-tailwindcss` + ESLint rules banning arbitrary/off-token classes | the enforcement layer |
| State | **Zustand** | small, no boilerplate; one store per concern |
| Routing | **TanStack Router** (type-safe) | few routes; type-safety is cheap to keep |
| Schemas/validation | **Zod** | sim options + the engine I/O contract |
| Advanced editor | **CodeMirror 6** | raw `.simc` editing (syntax highlight later) |
| Charts | **visx** | must be themeable — fed by tokens, no hardcoded colors |
| Worker comms | Comlink | from the overall plan |
| Local history | Dexie (IndexedDB) | from the overall plan |
| Fonts | `@fontsource-variable/*` (self-hosted) | CDN webfonts are blocked under COEP — see `src/main.tsx` |
| Item search | Fuse.js | Phase 2+ |
| Tests | **None for now** (see §8) | deliberately deferred |

---

## 2. Theming architecture

Shipped in U0 and documented authoritatively in `DESIGN_SYSTEM.md`. Summary of
the mechanism (which this plan does not relitigate):

**Two-tier token model:**

- **Primitive tokens** (`src/theme/tokens.css`) — the raw palette/scales
  (`--ink-950`, `--gold-400`, `--space-*`). Never referenced in markup.
- **Semantic tokens** (`src/theme/semantic.css`, prefixed `--c-`) — intent-named,
  the *only* tier components touch via Tailwind utilities (`bg-surface-raised`,
  `text-accent`, …). A semantic token expresses a role, not a value.

**A theme is one `[data-theme="..."]` block** remapping semantic → primitive. The
shipped theme is **`"noir"`** (Editorial Noir). Adding a theme later = one more
block; zero component changes. The `--c-quality-*` and `--c-tooltip-*` tokens are
WoW game constants and are **never** re-themed.

**Enforcement (`src/theme/theme.css` + lint):** Tailwind's default palette/scales
are stripped (`--color-*: initial`, etc.), so off-token classes (`text-blue-500`,
`w-[137px]`, `rounded-3xl`) literally don't compile. ESLint bans arbitrary values
and inline `style={{}}` outside a tiny allowlist (dynamic chart geometry; the
`/styleguide` swatch route). CI fails on violation.

The `/styleguide` route renders the live token surface and remains the canvas for
any future theme work.

---

## 3. Engine abstraction (parallel dev, no wasm dependency)

A single typed contract both implementations satisfy:

```ts
interface SimEngine {
  init(): Promise<EngineInfo>;                          // threads, cores, version, crossOriginIsolated
  inspect(input: SimInput): Promise<ParsedCharacter>;   // parse-only: identity + gear + talents, NO simulation
  run(input: SimInput, onProgress: (p: Progress) => void): Promise<SimReport>;
  cancel(): void;
}
```

- `SimInput` / `SimReport` are **Zod schemas** modeled on simc's `.simc` input
  and `json2` output (DPS, ability breakdown, buff/debuff uptimes, and the DPS
  distribution for the histogram — the last needs the distribution-collection
  flag enabled in the run args).
- **`inspect()` is new in this revision** and is what powers the Quick Sim
  compose-screen character preview (§6.2). The raw `/simc` string carries only
  **IDs** (item, bonus, gem, enchant) and a **talent loadout string** — no names,
  icons, quality, stats, or talent names. `inspect()` has simc *parse the profile
  without simulating* (effectively a zero-iteration / profile-echo pass) and emit
  a typed **`ParsedCharacter`**:
  - **identity** — name, class, spec, race, level, ilvl
  - **gear** — per slot: **itemId + bonus/gem/enchant ids + slot** (the minimum to
    place a tile and drive a Wowhead tooltip). Rich display — name, icon, quality,
    stat lines — is rendered by **Wowhead** from those ids at hover, so
    `inspect()` need not emit it (it may still echo name/ilvl/quality where simc
    provides them cheaply, e.g. for the context bar).
  - **talents** — the loadout string + the set of **selected node ids + ranks**
    (and names where simc provides them). Note: the talent *tree layout* (which
    nodes exist, their positions, edges, max ranks) is **not** part of
    `ParsedCharacter` — it comes from separate simc-derived talent-tree definition
    data merged at render time (see §6.2 and the dependency flag in §10).
  - This keeps Quick Sim **bundle-free**: structure comes from the engine, rich
    item/spell display from Wowhead at runtime — neither needs the Phase 2 item DB.
- **`MockEngine`** (Phase U1): runs in a worker, returns realistic
  `ParsedCharacter` and `SimReport` payloads shaped from **captured real simc
  `json2` samples**, with `run()` faking progress + cancel over a couple seconds.
- **`WasmEngine`** (later, U5): same interface, hosts `simc.wasm` via Comlink,
  MEMFS in / `out.json` out. `inspect()` is a fast parse pass; `run()` is the full
  sim.
- A factory + env flag selects the implementation. **Switching to the real engine
  is a one-line change**; all UI built against the mock keeps working.

---

## 4. Project structure

```
src/
  app/            # routes, providers, layout shell (sidebar, content header)
  theme/          # tokens, semantic themes, tailwind cfg, ThemeProvider, styleguide
  ui/             # styled primitives on Radix (Button, Dialog, Tabs, Popover,
                  #   Field, Tooltip, Chip, SlotTile, TalentTree, WowheadTooltip…)
  engine/         # SimEngine interface, MockEngine, WasmEngine, schemas, worker glue
  features/
    quick-sim/    # the vertical slice: compose → progress → report (§6)
    sim-options/  # shared fight-style/length/targets/precision controls (chips + popovers)
    character/    # parsed-character preview: identity, gear panel, talent tree (read-only now)
    advanced/     # raw simc input editor (CodeMirror) — Quick Sim follow-on (U3)
    report/       # report rendering + charts (shared by Quick Sim and later sim types)
    history/      # Dexie-backed run history (U4)
  lib/            # zod schemas, utils, crossOriginIsolated guard, Wowhead Power-script loader
```

`features/character/` and `features/sim-options/` are deliberately split out of
`quick-sim/`: both are reused verbatim by Gear / Droptimizer later (same gear
panel, same option controls, same talent display), so they live as shared
feature modules from the start.

---

## 5. Phased build — v1 (Phases 0 + 1 of `OVERALL_PLAN.md`)

> v1 ships running against `MockEngine` and has **no wasm/build dependency**.
> Item/spell *display* comes from **Wowhead at runtime** (the "Power" script +
> icon CDN — an external runtime dependency, not a build/bundle one), and the
> talent-tree layout is mocked from a sample fixture until the real engine-data
> bundle lands. Swapping in the real engine (U5) is the final integration step
> once the fork lands.

**Phase U0 — Foundation & theming spine — ✅ complete**
- Vite + React + TS scaffold; ESLint/Prettier; CI (lint + typecheck +
  token/arbitrary-value check); Cloudflare Pages preview.
- COOP/COEP: Vite dev headers + Cloudflare `_headers` — **`COOP: same-origin` +
  `COEP: credentialless`** (the `credentialless` mode, *not* `require-corp`, is
  what lets the no-cors Wowhead script/icon subresources load on the isolated
  page — `OVERALL_PLAN` §1); a runtime `crossOriginIsolated` guard component that
  surfaces a clear banner if isolation/threads are unavailable.
- Theming system (§2) end-to-end with the shipped **"noir"** theme + the
  `/styleguide` route.
- App shell: sidebar, content header strip, route skeleton (TanStack Router).

**Phase U1 — Engine seam**
- `SimEngine` interface (`init` / `inspect` / `run` / `cancel`) + Zod
  `SimInput` / `ParsedCharacter` / `SimReport` schemas, modeled on sample simc
  `json2` + parse output. `ParsedCharacter` is **id-centric** (identity + per-slot
  item/bonus/gem/enchant ids + selected talent node ids/ranks) — Wowhead renders
  the rich display from those ids, so no stat lines need to be schema'd (§3, §10).
- `MockEngine` in a worker via Comlink: `inspect()` returns a real-shaped parsed
  character; `run()` streams progress + supports cancel.
- `EngineInfo` panel / sidebar status chip (cores, threads, isolation status —
  `DESIGN_SYSTEM` §8.15).

**Phase U2 — Quick Sim (the first feature)** — *full spec in §6.* The cohesive
vertical slice:
- **Wowhead display layer (shared infra — build first).** A thin `WowheadTooltip`
  + icon wrapper in `ui/` that loads the Wowhead "Power" script
  (`wow.zamimg.com/js/tooltips.js`) once and renders item/spell/enchant/gem
  tooltips from ids (`bonus=`/`ilvl=`/`gems=`/`ench=` mapped from the simc string),
  hot-linking the icon CDN with the questionmark `onerror` fallback. Relies on
  `COEP: credentialless` (U0). Includes a visible "Item & spell data from Wowhead"
  attribution. **Shared by both the compose gear panel and the report's ability
  icons**, so it lands before either.
- **Compose** — paste `/simc` → `inspect()` → read-only character preview
  (identity + **gear** tiles w/ Wowhead tooltips + **talent tree**) + editable
  sim-option chips (fight style, targets, length, precision).
- **Run + progress** — live progress (iterations / `target_error` convergence,
  converging DPS estimate) + cancel.
- **Report** — DPS headline + distribution histogram, ability damage breakdown
  (with the "Show advanced" disclosure: casts / crit% / execute%), buff & debuff
  uptimes; ability icons/tooltips via the Wowhead layer. Built to `report.html`
  **minus** the Stat Scaling block (that block is Stat Weights — deferred; see §7).
- **Talent-tree data** — built in U2 against a **sample `talents.json` fixture**
  (the simc-derived tree layout, mocked alongside `MockEngine`); the real
  per-patch bundle ships with the engine in U5. If absent, the §6.5 fallback
  (compact loadout-string + named list) keeps Quick Sim shippable.
- **States** — empty, invalid-input, inspecting, running, error — all themed.

**Phase U3 — Quick Sim follow-ons (still Phase 1)**
- **Advanced mode** — raw `.simc` input editor (CodeMirror) feeding the same
  `inspect()` + `run()` path. Almost free once Quick Sim works.
- **Report actions** — Copy report / Export JSON from the report action row.

**Phase U4 — Report polish + local history**
- Richer themed report visualizations.
- Dexie-backed run history (list, reopen, delete) + **Save to history** from the
  report action row; gives the report a persistable identity / deep link.

**Phase U5 — Real-engine integration (gated on the fork)**
- Implement `WasmEngine`, swap the factory flag, validate that the real
  `json2` report and `inspect()` parse render through the existing components.
- Load the real **engine-data bundle** shipped with the fork (`talents.json` for
  the tree layout; `item-index.json` later for Gear search — `OVERALL_PLAN` §6),
  replacing the U2 sample fixture; confirm the talent tree renders from real data.
- No UI changes expected beyond swapping the fixture for the bundle.

---

## 6. Quick Sim — screen-by-screen UI spec

Quick Sim is one route (`/quick-sim`, also the app root) driven by a run-state
machine, not several pages. The app shell from `DESIGN_SYSTEM.md` §6 (220px
sidebar + 52px content header strip + page) is constant across every state; only
the page body and the header's right-hand controls change.

**Run-state machine** (Zustand store in `features/quick-sim/`):

```
empty ──paste──► inspecting ──ok──► ready ──RUN──► running ──ok──► report
   ▲                  │                │              │                │
   └──────────────────┴── error ◄──────┴──────────────┴── cancel ──────┘
```

Report persistence (stable URL / id) arrives with history in U4; until then the
report is in-memory transient state of this route.

### 6.1 Compose screen — shell & options

Mirrors the **Gear screen composition** (`DESIGN_SYSTEM.md` §6) so Quick Sim and
Gear feel like one tool:

```
┌─ Sidebar (220px) ──┬─ Main content ────────────────────────────────┐
│ Brand              │ [Content header strip — 52px]                  │
│ Nav (Quick Sim ●)  │   "Quick Sim"            [option chips →]      │
│ ...                │ ──────────────────────────────────────────────│
│                    │ [Character context bar]                        │
│                    │   Name · Spec · ilvl        [RUN SIMULATION]   │
│                    │ ──────────────────────────────────────────────│
│ Footer (engine)    │ [Profile source disclosure]                    │
│                    │ [Two-pane: 310px Gear │ flex Talents]          │
└────────────────────┴────────────────────────────────────────────────┘
```

- **Content header strip** — breadcrumb shows `Quick Sim` (current). The
  right-hand **setting chips** (Fight Style · Targets · Length · Precision,
  `DESIGN_SYSTEM` §6 / §8.2) are the **canonical sim-options UI**: on compose they
  are **editable** (each chip is a Radix `Popover` trigger opening the relevant
  control); on the report they render **read-only**. One representation, two
  modes — `features/sim-options/` owns both.
  - **Precision** popover carries the honest "fast vs precise" framing: it sets
    `target_error` / iteration count — the main client-side performance lever.
- **Character context bar** (below the strip, like gear.html's) — left: identity
  (`name` · `spec` in `text-accent` caps · `ilvl`), populated from `inspect()`.
  Right: the primary **RUN SIMULATION** button (`DESIGN_SYSTEM` §8.3, gold fill,
  `text-accent-fg`), disabled until a character is parsed.

### 6.2 Compose screen — body states

**Empty** (`empty`): a focal paste box centered in the page — the inset code well
(`bg-surface-inset`, `font-mono text-sm`, `rounded-lg`, hairline border) with a
label and guidance: *"Paste the string from the SimulationCraft in-game addon
(`/simc`)."* RUN disabled. (A dev-only "load example" affordance is fine behind a
flag.)

**Inspecting** (`inspecting`): on a paste that looks like a simc profile,
`engine.inspect()` runs (debounced). Show a quiet inline progress state on the
paste box — no full-screen spinner (motion rules, `DESIGN_SYSTEM` §5).

**Ready** (`ready`): the parsed character is the focus.

- **Profile source disclosure** — the paste box collapses into a slim
  progressive-disclosure row (`DESIGN_SYSTEM` §8.14), "Profile source", that
  re-expands to edit/replace the string. Keeps the raw text available without
  letting it dominate.
- **Two-pane preview** — reuse the gear screen's grid
  (`grid-template-columns: 310px 1fr; gap: 20px`; both panels `bg-surface-raised`,
  `border-border-subtle`, `rounded-lg`):
  - **Gear panel (left, 310px)** — read-only **slot tiles** exactly per
    `DESIGN_SYSTEM` §8.6 (quality stripe, ilvl badge, quality-colored icon
    border), each with the **Wowhead item tooltip** on hover **and**
    `:focus-visible` — the Wowhead "Power" script renders it from the item id +
    `bonus=`/`ilvl=`/`gems=`/`ench=` (mapped from the simc string). Icons via the Wowhead icon CDN (§7 of the
    design system). Slot/id data from `ParsedCharacter.gear`; rich stats from
    Wowhead, so `inspect()` need not emit full stat lines (see §10).
  - **Talent panel (right, flex)** — read-only **full talent tree grid** (new
    component, §6.5).
- Both panels are **read-only now but built with an `editable` seam** (the tile /
  node components take an `interactive` prop) so in-place gear and talent editing
  drops in later without restructuring.

**Invalid / error** (`error`): a paste that doesn't parse shows an inline message
in `text-danger` under the paste box (and re-expands the source disclosure). An
`inspect()` engine failure shows the same treatment with the engine's message.

### 6.3 Progress screen (`running`)

RUN swaps the body for a quiet progress block; the context bar persists with RUN
replaced by **Cancel** (ghost/danger, `DESIGN_SYSTEM` §8.4). Centered block:

- A **converging DPS estimate** — a muted preview of the report's DPS headline
  (`DESIGN_SYSTEM` §8.10 treatment, dimmed) that updates from `onProgress`.
- A **progress bar** keyed to iterations or `target_error` convergence
  (`bg-bar` / `bg-bar-track`), with a `font-mono` readout of current
  `target_error` ± and iteration count.
- Elapsed time and a small **thread/core utilization** line tied to `EngineInfo`.
- Motion stays quiet — no indefinite animated skeletons (`DESIGN_SYSTEM` §5).

A **sim failure** transitions to `error`: an error panel in the body with the
message and a **Retry** action; the parsed character + options are preserved.

### 6.4 Report screen (`report`)

Built to `docs/mockups/report.html` against the tokens, with two scope deltas:

- **Breadcrumb** becomes `Quick Sim › Report`; the **setting chips render
  read-only**; the strip shows the **Re-run** button (`DESIGN_SYSTEM` §6).
- Content (centered page, `max-width: 1100px`):
  1. **Character identity block** (§ report mockup).
  2. **DPS headline + distribution histogram** (`DESIGN_SYSTEM` §8.10, §8.13) —
     `target_error` ± and iteration meta below; histogram via visx, colors read
     from tokens at render (never hardcoded).
  3. **Ability damage breakdown** table (`DESIGN_SYSTEM` §8.11) with the
     **"Show advanced metrics"** progressive disclosure (§8.14) revealing the
     Casts / Crit% / Execute% columns.
  4. **Buff & debuff uptimes** grid (`DESIGN_SYSTEM` §8.12).
  5. **Action row** — present from U2 but several actions are **deferred**: Copy
     report / Export JSON land in U3; Save to history in U4. Timestamp shown.
- **Excluded from the first report:** the mockup's **Stat Scaling** block. That
  is Stat Weights (a `scale_factors` run) — a separate, slower sim mode that
  `OVERALL_PLAN` scopes to Phase 4. The "Show advanced metrics" columns
  (casts/crit/execute) **are** included because they come free from `json2`;
  stat scaling does **not** and is deferred (§7).

### 6.5 New component — read-only talent tree

No mockup or component spec exists for this yet; it is specified here at plan
altitude and needs a dedicated design pass (and the data in §10) before final
build. Token-grounded intent:

- **Container** — `bg-surface-raised`/`inset`, `border-border-subtle`,
  `rounded-lg`, panel padding per `DESIGN_SYSTEM` §5.
- **Layout** — class / spec / hero sub-grids, nodes positioned from the
  **talent-tree definition data** (§10), connection lines 1px `border-subtle`
  with the active/selected path drawn in `accent-dim`.
- **Node** — the real talent icon (icon CDN, `rounded-sm`, §7 of the design
  system). **Selected**: full opacity + `accent` ring/border; **unselected/
  available**: dimmed (~0.4 opacity) with `border-border-subtle`; **ranked**:
  an `x/y` rank pip. Choice vs passive nodes follow in-game shape conventions.
- **Read-only**: the only interaction is a tooltip on hover/`:focus-visible`
  (talent name + description) — rendered via Wowhead from the talent/spell id.
  The `interactive` seam for future editing is stubbed but inert.
- **Selected nodes/ranks** come from `ParsedCharacter.talents`; the **tree shape**
  comes from the definition data, merged at render.
- **Graceful fallback** (if tree-definition data isn't ready, §10): degrade to a
  compact read-only view — the loadout import string + a flat named list of
  chosen talents with ranks — so the rest of Quick Sim is **not** gated on the
  tree.

---

## 7. Later phases (sketch only)

- **Gear (Phase 2 UI):** item DB load + Fuse.js search, slot-based item picker
  (reuses `features/character/` slot tiles, now editable), gear-set editor, Top
  Gear / Gear Compare result tables + combinatorial-cap warnings. New
  `features/gear/`, reuses the engine seam (profileset inputs).
- **Droptimizer (Phase 3 UI):** loot-source browser (instance→encounter→items),
  per-drop delta table, EV/Best-Drop/Priority views. Heaviest data + aggregation
  UI.
- **Stat Weights (Phase 4 UI):** the deferred **Stat Scaling** block from the
  report mockup, driven by a `scale_factors` run, with the "you probably
  shouldn't over-index on these" community framing. Renders into the report's
  advanced area.
- **Polish (Phase 4 UI):** report sharing (needs the optional CF Worker/API),
  Armory import form, settings, user-facing theme switcher, in-place gear/talent
  **editing** (flipping the `interactive` seams built in U2 to live).

All later phases inherit the same token system and engine seam — no architectural
change, just new `features/`.

---

## 8. Testing

**No tests are written for now.** This is a deliberate choice for the early build
phases to keep iteration fast while the structure and design settle. The
architecture (typed engine seam, Zod schemas, separated behavior/style) keeps the
code testable so a suite can be added later without restructuring. When tests are
introduced, the intended stack is Vitest + Testing Library (unit/component
against `MockEngine`) and Playwright (e2e), plus a smoke check that
`crossOriginIsolated === true` and the thread pool is sized to cores once
`WasmEngine` lands.

---

## 9. Design status & mockup coverage

Design has **landed** ("Editorial Noir"), so the v0.1 "build now, dress later"
sequencing no longer applies. What remains is a coverage gap in the mockups, not
in the design system:

| Surface | Mockup? | Status |
|---|---|---|
| App shell (sidebar, header strip, chips) | `gear.html` / `report.html` | ✅ build to spec |
| Quick Sim **report** | `report.html` | ✅ build to spec (minus Stat Scaling, §6.4) |
| Gear screen + slot tiles | `gear.html` | ✅ specs reused for the compose gear panel |
| Item / spell tooltip | `gear.html` / `report.html` (visual ref) | Wowhead-rendered from ids; `DESIGN_SYSTEM` §8.8 spec kept as visual reference only |
| Quick Sim **compose** screen | none | spec'd here (§6.1–6.2) against the tokens |
| Quick Sim **progress** screen | none | spec'd here (§6.3) against the tokens |
| **Talent tree** component | none | spec'd at altitude (§6.5); needs a design pass + data (§10) |

The compose and progress screens reuse existing, already-designed primitives
(slot tiles, chips, popovers, buttons, the DPS headline treatment), so "no
mockup" means "compose the known parts," not "invent a new look." The **talent
tree** is the one genuinely new visual component and is the main design/data risk
in Quick Sim (§10).

---

## 10. Open items to revisit

- **Talent-tree definition data — the one structural dependency.** The full
  read-only tree grid (§6.5) needs node/position/edge/icon/max-rank data per class,
  spec, and hero tree. `inspect()` only yields *which* nodes are selected, not the
  tree shape, and Wowhead's tooltip embed renders individual talents but does **not**
  hand us the tree graph. **Source:** an **additive, read-only script in the simc
  fork's CI** emits a compact `talents.json` (not a source patch → keeps the fork
  rebaseable, `OVERALL_PLAN` §5) — from simc's trait data if it carries node
  positions/edges, otherwise from Blizzard's Talent Tree API. Either way it's a
  per-patch byproduct, *not* a hand-maintained or Wowhead-replacement DB
  (`OVERALL_PLAN` §6, layer 3). Still **tracked as a named risk** with the §6.5
  fallback (compact loadout-string + named-list view) so Quick Sim ships regardless
  of when the tree data lands; scope it alongside U2.
- `inspect()` fidelity — now **lower-risk**: because Wowhead renders the rich
  display (names, icons, quality, stat lines) from item/spell ids, `inspect()` only
  needs to emit **identity + per-slot item ids/bonus ids + selected talent node
  ids**, not full stat lines. Finalize `ParsedCharacter` against a real simc parse
  pass once the fork can emit one (the item/bonus ids and talent node ids are the
  fields that matter and the ones most likely to drift).
- Report schema fidelity — finalize `SimReport` (incl. the DPS-distribution data
  for the histogram) against real `json2` samples once the fork emits them.
- CodeMirror simc syntax highlighting — basic editor first (U3); custom language
  mode is a later enhancement.
- Theme switcher exposure — mechanism shipped in U0, surfaced to users in Phase 4.
