# Web UI Implementation Plan (`web` repo) — v0.3

Companion to [`OVERALL_PLAN.md`](./OVERALL_PLAN.md). That document settles the
product, architecture, and engine strategy. This one details **how the web UI is
built**: technologies, theming, the engine abstraction, and the phased build
order.

The architecture in `OVERALL_PLAN.md` is treated as settled and is **not**
relitigated here (React + TS + Vite, Comlink-over-Web-Worker to a threaded
`simc.wasm`, MEMFS/`json2` I/O, Dexie history, Fuse.js search, Cloudflare Pages).

**What changed since v0.2 — the engine is real.** The single biggest assumption
of v0.1/v0.2 was *"the fork isn't ready, so build entirely against a `MockEngine`
and swap the real `WasmEngine` in last (U5), gated on the fork."* **That gate is
gone.** The fork now publishes a consumable, threaded/SIMD WebAssembly build as a
versioned GitHub release — **`simc-wasm` `v1205.01`**
([release](https://github.com/a-vasilev/simc-wasm/releases/tag/v1205.01)). This
revision folds that in and **re-sequences the build so the real engine is brought
up early as a spine**, not bolted on at the end. Details: §3 (artifact contract)
and §5 (re-sequenced phases).

**What the release actually contains** (this is the contract the web app codes
to — see §3.1):

| Asset | What it is |
|---|---|
| `simc.js` (~80 KB) | Emscripten ES6 glue — `import createSimc from './simc.js'`, a `MODULARIZE`/`EXPORT_ES6` default export returning `Promise<Module>` |
| `simc.wasm` (~107 MB) | the threaded/SIMD binary with baked game data (flags: `-pthread -msimd128 -fwasm-exceptions -O3 -sPROXY_TO_PTHREAD -sMODULARIZE -sEXPORT_ES6`) |
| `manifest.json` | `release_tag`, `sc_version`, `upstream_base_sha`, `emsdk_version`, `build_flags`, and per-file **sha256** hashes — the pin + integrity record |

**Two consequences that reshape the plan:**

1. **Real engine first, not last.** We can prove the whole client-side sim
   end-to-end *now* (OVERALL_PLAN's "Phase 0 spine") and finalize the Zod
   `SimReport`/`ParsedCharacter` schemas against **real `json2`** instead of
   guessing. `MockEngine` does **not** go away — it stays the fast-iteration /
   offline implementation behind the same seam — but the high-risk integration
   (107 MB load, cross-origin-isolated threads, MEMFS I/O, real report shape)
   moves to the front where it de-risks everything after it.
2. **The engine-data bundle has *not* shipped yet.** `v1205.01` is the **wasm +
   glue only** — there is **no `talents.json` / `item-index.json` in it**, even
   though OVERALL_PLAN §6 describes them as a per-patch byproduct of the same CI.
   So the talent-tree layout remains on the **§6.5 fallback / sample fixture**
   until a later release adds those files; nothing in Quick Sim is gated on them
   (it never was). This corrects the v0.2 wording that said the bundle "ships with
   the wasm in U5."

**Also still true from v0.2:**

- **The design landed — "Editorial Noir".** Tokens, typography, the app shell,
  and component specs are settled in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) +
  `src/theme/`, with reference mockups in `docs/mockups/` (`gear.html`,
  `report.html`). New UI is built against those tokens, not ad-hoc styles.
- **Phase U0 shipped** (foundation + theming spine).

---

## 0. Guiding principles

1. **Tokens or nothing.** No raw color/spacing/font/radius value ever appears in
   a component. Every visual value resolves through a *semantic design token*. A
   theme change = swapping one token map, touching zero component files. This is
   enforced mechanically (lint + a deliberately stripped Tailwind palette), not by
   discipline. Full rationale + enforcement: `DESIGN_SYSTEM.md` §11.
2. **The engine is behind a seam.** All UI work targets a typed `SimEngine`
   interface. There are now **two real implementations** behind it: `MockEngine`
   (fast iteration / offline / future tests) and `WasmEngine` (the published
   `simc-wasm` release). Nothing in the UI imports wasm directly; a factory + env
   flag picks the implementation, and every component renders identically against
   either. The seam is no longer a stand-in for an absent engine — it's how the
   UI stays decoupled from a 107 MB artifact and lets us keep developing UI states
   (empty/error/invalid) without booting the binary every reload.
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

## 3. Engine abstraction & the real engine artifact

A single typed contract every implementation satisfies:

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
  Stays the default for fast UI loops and offline work even after the real engine
  lands.
- **`WasmEngine`** (Phase U2 — now early, no longer last): same interface, hosts
  the published `simc.js`/`simc.wasm` via Comlink, MEMFS in / `out.json` out.
  `inspect()` is a fast minimal-iteration parse pass; `run()` is the full sim. See
  §3.1 for the concrete consumption contract.
- A factory + env flag selects the implementation. Switching between mock and real
  is a one-line change; all UI built against either keeps working.

### 3.1 Consuming the engine release (`simc-wasm v1205.01`)

The `WasmEngine` is the only place in the app that touches the artifact. The
release contract (from the release notes + `manifest.json`):

- **Module shape.** `simc.js` is `MODULARIZE` + `EXPORT_ES6`, so the host worker
  does `import createSimc from '<engine-url>/simc.js'` → `await createSimc({...})`
  → a standard Emscripten `Module`. We drive it **CLI-style** (OVERALL_PLAN §5):
  write the profile to a `.simc` file in **MEMFS**, run `main()` with
  `json2=out.json` (+ run args), read `out.json` back, `Zod`-parse into
  `SimReport`. No embind. The host worker is the existing Comlink orchestration
  worker; the engine spawns its **own pthread pool** beneath it (`PROXY_TO_PTHREAD`
  → `main()` already runs off the host worker's thread).
- **The same-origin split (what must be local vs. what can be remote).** Pthreads
  are Web Workers the glue spawns by re-loading **`simc.js` itself** as an
  `em-pthread` worker, and worker scripts must be **same-origin** — so **`simc.js`
  (~80 KB) is vendored into the app and served same-origin** (a normal Pages static
  asset, well under the 25 MiB limit). The **107 MB `simc.wasm` can be remote**: it
  is fetched **once, on the host thread**, and Emscripten shares the compiled
  `WebAssembly.Module` to the pthread workers via `postMessage` — the pthreads
  **never re-fetch it**. So exactly one cross-origin fetch, on one thread. We point
  `Module.locateFile` (or a `Module.instantiateWasm` override) at the remote wasm
  URL; neither file enters the Vite graph (a 107 MB asset must never be bundled).
- **Hosting the 107 MB binary — R2 custom domain, no Worker (chosen).** It
  **cannot** be a Cloudflare Pages static file (Pages enforces a **25 MiB per-file
  limit**) and must not live in git or be bundled. Approach: store the versioned
  artifact in **R2** and expose the bucket via an **R2 custom domain**
  (`engine.<domain>/<tag>/simc.wasm`) — no Function/Worker in the path at all.
  Simpler (no streamer code to write/deploy/maintain) and cheaper (no Worker
  invocations; R2 egress is free, storage/read ops sit comfortably in the free
  tier). The custom domain is a **subdomain → cross-origin**, which is fine for the
  *wasm* because we fetch it ourselves in **CORS mode**: configure R2 CORS to send
  `Access-Control-Allow-Origin` for the app origin, giving a **non-opaque** response
  that `WebAssembly.instantiate(Streaming)` accepts. `COEP: credentialless` (U0)
  permits this — credentialless only strips credentials from *no-cors* subresources;
  an explicit CORS fetch with `ACAO` is unaffected. Emscripten's default wasm fetch
  may need nudging to CORS mode (override via `Module.instantiateWasm`, or fetch the
  bytes ourselves and hand over `Module.wasmBinary`).
- **This is an "if it works" path — validated in U2, with a fallback.** The whole
  approach hinges on the cross-origin CORS-mode wasm fetch succeeding under our
  COOP/COEP headers; that's the **first thing the U2 bring-up proves**. If it
  doesn't pan out, fall back to serving the wasm from a **same-origin path**
  (`/<engine>/<tag>/simc.wasm`) via a Cloudflare Pages Function / Worker that
  streams from R2 — robust but adds a (read-only) Function and, at high traffic,
  Worker-invocation cost unless edge-cached. **This is not the optional OAuth/
  sharing backend** (OVERALL_PLAN §3) either way.
- **Versioning & integrity.** Pin the engine **tag** (`v1205.01`) in app config;
  fetch by immutable versioned URL; verify the downloaded bytes against the
  **sha256 in `manifest.json`** before instantiating, and surface a clear error on
  mismatch. `data patch == engine patch` (OVERALL_PLAN §4): bumping the engine is a
  config/tag change, decoupled from app redeploys.
- **First-load UX.** 107 MB is a one-time, cacheable download. The engine load is
  **lazy** (only when a real run is first requested) and behind a progress state;
  cache via the Cache API / service worker keyed by version so patch bumps
  invalidate cleanly. The U0 `crossOriginIsolated` guard already gates whether
  threads are even available.
- **What's *not* in the release.** No `talents.json` / `item-index.json` yet
  (§5 "Adopt the engine-data bundle" + §10). The talent tree stays on the §6.5
  fallback / sample fixture; the
  item-search index is a Phase 2 concern regardless.

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
    advanced/     # raw simc input editor (CodeMirror) — Quick Sim follow-on (U4)
    report/       # report rendering + charts (shared by Quick Sim and later sim types)
    history/      # Dexie-backed run history (U5)
  lib/            # zod schemas, utils, crossOriginIsolated guard, Wowhead Power-script loader
```

`features/character/` and `features/sim-options/` are deliberately split out of
`quick-sim/`: both are reused verbatim by Gear / Droptimizer later (same gear
panel, same option controls, same talent display), so they live as shared
feature modules from the start.

---

## 5. Phased build — v1 (Phases 0 + 1 of `OVERALL_PLAN.md`)

> **Re-sequenced for the real engine (v0.3).** The engine seam is established
> against the **mock first** (U1), the **real `WasmEngine` is brought up
> immediately after as a spine** (U2) — booting `simc-wasm v1205.01`, running a
> trivial sim end-to-end, and finalizing the report/parse schemas against real
> `json2` — and only **then** is the polished Quick Sim UI built on top (U3),
> running against either engine. This front-loads the one genuinely hard, novel
> integration (107 MB cross-origin-isolated threaded wasm) instead of saving it
> for last. Item/spell *display* still comes from **Wowhead at runtime** (the
> "Power" script + icon CDN), and the **talent-tree layout stays on a sample
> fixture** — the engine-data bundle (`talents.json`) is **not** in `v1205.01`
> (§3.1, §10), so its arrival is a small later adoption step, not a gate.

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

**Phase U1 — Engine seam + MockEngine**
- `SimEngine` interface (`init` / `inspect` / `run` / `cancel`) + Zod
  `SimInput` / `ParsedCharacter` / `SimReport` schemas, modeled on sample simc
  `json2` + parse output. `ParsedCharacter` is **id-centric** (identity + per-slot
  item/bonus/gem/enchant ids + selected talent node ids/ranks) — Wowhead renders
  the rich display from those ids, so no stat lines need to be schema'd (§3, §10).
  These schemas are **provisional** here and finalized against real `json2` in U2.
- `MockEngine` in a worker via Comlink: `inspect()` returns a real-shaped parsed
  character; `run()` streams progress + supports cancel.
- `EngineInfo` panel / sidebar status chip (cores, threads, isolation status —
  `DESIGN_SYSTEM` §8.15).
- Engine **factory + env flag** scaffolded now (mock is the only implementation
  yet), so U2 drops the real engine in without restructuring.

**Phase U2 — `WasmEngine` bring-up (the engine spine)** — *consumption contract
in §3.1.* This is OVERALL_PLAN's "Phase 0 spine" realized on the web side:
proving the real client-side sim end-to-end **before** investing in polished UI.
- **Artifact hosting + the cross-origin proof (do this first).** Vendor `simc.js`
  same-origin; host the versioned `simc.wasm` on an **R2 custom domain** (no
  Worker) with CORS for the app origin; pin tag `v1205.01`; verify bytes against
  the `manifest.json` sha256 (§3.1). **Validate the cross-origin CORS-mode wasm
  fetch + instantiate works under our COOP/COEP before building anything else** —
  if it doesn't, switch to the same-origin Pages-Function streamer fallback (§3.1).
- **`WasmEngine` implementation.** Host worker `import`s `createSimc`, sizes the
  pthread pool to cores, writes the `.simc` profile to MEMFS, runs `main()` with
  `json2=out.json` + run args, reads/`Zod`-parses `out.json`. `run()` streams
  progress (iterations / `target_error`) + supports `cancel()`; `inspect()` is a
  minimal-iteration parse pass yielding `ParsedCharacter`.
- **End-to-end validation harness.** A dev-only route/panel that loads the engine,
  confirms `crossOriginIsolated === true` and real multi-core usage, runs a pasted
  `/simc` Quick Sim, and dumps the raw + parsed report. No polished UI yet — this
  is the de-risking spike.
- **Schema finalization.** Lock `SimReport` (incl. the DPS-distribution data for
  the histogram — needs the distribution-collection flag) and `ParsedCharacter`
  against **real `json2`**, then re-shape the `MockEngine` fixtures to match so the
  mock stays a faithful stand-in (§10).
- The factory now selects mock **or** real via the env flag; mock remains the
  default for fast UI iteration.

**Phase U3 — Quick Sim (the first feature)** — *full spec in §6.* The cohesive
vertical slice, now buildable against **either** engine (real for fidelity, mock
for fast loops):
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
- **Talent-tree data** — built against a **sample `talents.json` fixture** (the
  simc-derived tree layout, mocked alongside `MockEngine`), because the real
  per-patch bundle is **not yet in the engine release** (§3.1). If the fixture is
  absent, the §6.5 fallback (compact loadout-string + named list) keeps Quick Sim
  shippable.
- **States** — empty, invalid-input, inspecting, running, error — all themed.
  Because the real engine exists, `running`/`report`/`error` are exercised against
  **real sims** here, not only the mock's faked progress.

**Phase U4 — Quick Sim follow-ons (still Phase 1)**
- **Advanced mode** — raw `.simc` input editor (CodeMirror) feeding the same
  `inspect()` + `run()` path. Almost free once Quick Sim works.
- **Report actions** — Copy report / Export JSON from the report action row.

**Phase U5 — Report polish + local history**
- Richer themed report visualizations.
- Dexie-backed run history (list, reopen, delete) + **Save to history** from the
  report action row; gives the report a persistable identity / deep link.

**Adopt the engine-data bundle (when a later engine release adds it).** Not a
phase — a small, non-gating adoption step. When a `simc-wasm` release ships
`talents.json` (and later `item-index.json` for Gear), load it from the versioned
engine path and replace the U3 sample fixture; the talent tree then renders from
real per-patch data with **no UI change** (the §6.5 fallback already absorbs its
absence). `item-index.json` is otherwise a Phase 2 / Gear concern (§7).

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

Report persistence (stable URL / id) arrives with history in U5; until then the
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
  5. **Action row** — present from U3 but several actions are **deferred**: Copy
     report / Export JSON land in U4; Save to history in U5. Timestamp shown.
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

- **Top Gear (Phase 2 UI):** slot-based item picker (reuses `features/character/`
  slot tiles, now editable), candidate-set editor, Top Gear result table +
  combinatorial-cap warnings. New `features/gear/`, reuses the engine seam
  (profileset inputs). There is **no separate Gear Compare** — set-vs-set is
  subsumed by Top Gear, which sims any combination you assemble. **Built in two
  increments so the item-index never gates the whole feature** (§10):
  - **2a — profile-scoped Top Gear (no index).** Top Gear over items **already in
    the pasted profile** — equipped *plus* the bag/bank gear the simc addon can
    export. simc resolves each item string to stats at sim time; Wowhead renders
    display from the ids. This needs **no item catalog at all** and covers a large
    share of real Top-Gear use ("best combination of what I already have").
  - **2b — arbitrary-item picker (needs the index).** The "add an item I don't own"
    catalog search — Fuse.js over the **`item-index.json` search list** (id / name /
    slot / ilvl / quality / icon-name / valid bonus options; the fork's read-only CI
    byproduct, §10). This is the *only* slice that needs the index, and the only
    runtime source for it: simc has no item-query (`spell_query` is spells/talents
    only) and Wowhead has no usable search API, so a static index is required here.
- **Droptimizer (Phase 3 UI):** loot-source browser (instance→encounter→items),
  per-drop delta table, EV/Best-Drop/Priority views. Heaviest data + aggregation
  UI.
- **Stat Weights (Phase 4 UI):** the deferred **Stat Scaling** block from the
  report mockup, driven by a `scale_factors` run, with the "you probably
  shouldn't over-index on these" community framing. Renders into the report's
  advanced area.
- **Polish (Phase 4 UI):** report sharing (needs the optional CF Worker/API),
  Armory import form, settings, user-facing theme switcher, in-place gear/talent
  **editing** (flipping the `interactive` seams built in U3 to live).

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

- **Talent-tree definition data — enhancement, NOT a blocker, and not in
  `v1205.01`.** The engine release shipped the wasm + glue only (§3.1); the
  engine-data bundle (`talents.json`/`item-index.json`) has **not** landed yet. The
  full read-only tree grid (§6.5) needs node/position/edge/icon/max-rank data per
  class, spec, and hero tree. `inspect()` only yields *which* nodes are selected, not
  the tree shape, and Wowhead's tooltip embed renders individual talents but does
  **not** hand us the tree graph — so the *graph* is the only thing this data adds.
  **Crucially, nothing is gated on it:** Quick Sim ships on the §6.5 fallback
  (compact loadout-string + named-list view), and adoption when the data lands is a
  no-UI-change swap (§5). **Source (unchanged):** an **additive, read-only script in
  the simc fork's CI** emits a compact `talents.json` (not a source patch → keeps the
  fork rebaseable, `OVERALL_PLAN` §5) — from simc's trait data if it carries node
  positions/edges, otherwise from Blizzard's Talent Tree API. **Action:** confirm
  with the fork whether a coming release attaches the data bundle; treat the full
  tree as a polish item layered on the shipped fallback, not a precondition.
- **Item-search index — gates only Gear increment 2b, not Phase 2 as a whole.** The
  `item-index.json` search list (id / name / slot / ilvl / quality / icon-name /
  valid bonus options — a *search list*, **not** a stats DB; stats come from simc at
  sim time, display from Wowhead) is **required** for the "add an item I don't own"
  catalog picker, because there is no runtime alternative: simc exposes no item
  query (`spell_query` is spells/talents/effects/set_bonus only) and Wowhead has no
  usable/CORS-accessible search API (scraping is out, `OVERALL_PLAN` §6). But Gear
  **2a** (Top Gear over profile items — equipped + the addon's
  bag/bank export) needs **no index**, so the index is sequenced as a *second* Gear
  increment (§7) rather than a Phase 2 prerequisite. **Source (unchanged):** the
  fork's additive read-only CI byproduct from simc's baked item data (`dbc_extract`),
  versioned with the wasm so `data patch == engine patch` (`OVERALL_PLAN` §6). Do
  **not** extract it from the running wasm — there is no query/dump command, so that
  would mean patching the fork *and* shipping the data redundantly inside the 107 MB
  binary. **Action:** confirm the next engine release attaches `item-index.json`;
  until then build Gear 2a, which doesn't need it.
- `inspect()` realization & fidelity — **now actionable, not blocked.** The fork
  can emit real `json2`, so finalize `ParsedCharacter` in **U2** against a real
  parse pass (identity + per-slot item/bonus/gem/enchant ids + selected talent node
  ids/ranks — Wowhead renders the rich display, so no stat lines needed). Open
  detail: the exact simc invocation that yields a parse-only echo cheaply
  (minimal-iteration run vs. a dedicated flag) — pin it during U2 bring-up.
- Report schema fidelity — **resolved by U2.** Finalize `SimReport` (incl. the
  DPS-distribution data for the histogram, which needs the distribution-collection
  run flag) against the **real `json2`** the engine now emits, then re-shape the
  `MockEngine` fixtures to match.
- Engine artifact hosting — **chosen: R2 custom domain, no Worker** (`simc.js`
  vendored same-origin, `simc.wasm` cross-origin via CORS — §3.1), for simplicity
  and cost. **The open risk is the cross-origin CORS-mode wasm fetch under
  `COEP: credentialless`** — prove it in the U2 spike; fall back to a same-origin
  Pages-Function streamer if it fails. Confirm R2 CORS config, immutable
  cache-control headers, and the exact Emscripten hook (`Module.instantiateWasm`
  vs. `wasmBinary`) for forcing CORS mode.
- CodeMirror simc syntax highlighting — basic editor first (U4); custom language
  mode is a later enhancement.
- Theme switcher exposure — mechanism shipped in U0, surfaced to users in Phase 4.
