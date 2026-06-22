# Web UI Implementation Plan (`web` repo) — v0.1

Companion to [`OVERALL_PLAN.md`](./OVERALL_PLAN.md). That document settles the
product, architecture, and engine strategy. This one details **how the web UI is
built**: technologies, theming, the engine abstraction, and the phased build
order — with v1 in depth and later phases sketched.

The architecture in `OVERALL_PLAN.md` is treated as settled and is **not**
relitigated here (React + TS + Vite, Comlink-over-Web-Worker to a threaded
`simc.wasm`, MEMFS/`json2` I/O, Dexie history, Fuse.js search, Cloudflare Pages).

---

## 0. Guiding principles

1. **Tokens or nothing.** No raw color/spacing/font/radius value ever appears in
   a component. Every visual value resolves through a *semantic design token*. A
   theme change = swapping one token map, touching zero component files. This is
   enforced mechanically (lint + a deliberately stripped Tailwind palette), not by
   discipline.
2. **The engine is behind a seam.** All UI work targets a typed `SimEngine`
   interface with a **mock implementation**. The real `simc.wasm` is just another
   implementation of that interface, dropped in later. Nothing in the UI imports
   wasm directly. This is how we develop in full parallel with the fork **without
   depending on it yet**.
3. **Design-agnostic structure.** The visual design lands separately and later.
   We build the *system* now (tokens, primitives, layout shell, component
   contracts) and let the actual look be a late-binding token file + Tailwind
   theme. See §8 for exactly when design becomes a blocker.

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
| Advanced editor | **CodeMirror 6** | simc input editing (syntax highlight later) |
| Charts | **visx** | must be themeable — fed by tokens, no hardcoded colors |
| Worker comms | Comlink | from the overall plan |
| Local history | Dexie (IndexedDB) | from the overall plan |
| Item search | Fuse.js | Phase 2+ |
| Tests | **None for now** (see §7) | deliberately deferred |

Nothing exotic is relied upon yet — Tailwind v4 is used as a clean base, not for
any one specific plugin.

---

## 2. Theming architecture (priority)

Goal: one theme on day one, but built so it is **trivial to iterate and fully
swap later** without touching components.

**Two-tier token model:**

- **Primitive tokens** — the raw palette/scales (`--blue-500`, `--space-4`,
  `--radius-md`, `--font-size-2`). Never referenced in markup.
- **Semantic tokens** — intent-named, the *only* thing components touch:
  `--color-surface`, `--color-surface-raised`, `--color-accent`, `--color-text`,
  `--color-text-muted`, `--color-border`, `--color-danger`, `--color-dps`, etc.
  Semantic tokens point at primitives.

**A theme is just a remap of semantic → primitive**, declared under a
`[data-theme="..."]` selector on `<html>`. Day one ships **one** neutral
placeholder theme. Adding/replacing a theme later = add one selector block; the
mechanism (provider + attribute toggle + persistence) is built now even though
only one theme exists.

**How Tailwind v4 enforces "no stray styles":**

- In `@theme`, define **only our semantic tokens** and **do not load Tailwind's
  default color palette**. Result: `text-blue-500` literally does not compile —
  only `text-accent`, `bg-surface`, etc. exist. Off-token color is impossible *by
  construction*, not by convention.
- Same treatment for spacing/radius/typography/shadow/z-index/motion: only our
  scale steps exist as utilities; magic numbers can't be expressed.
- ESLint bans Tailwind **arbitrary values** (`w-[137px]`, `text-[#abc]`) and bans
  inline `style={{}}` outside a tiny allowlist (e.g. dynamic chart geometry). CI
  fails on violation.
- `prettier-plugin-tailwindcss` canonicalizes class order so diffs stay clean.

**Deliverable:** a `theme/` module — `tokens.css` (primitives), `semantic.css`
(one block per theme), the Tailwind config, the lint config, a `<ThemeProvider>`
that sets the attribute + persists choice, and a **styleguide route** rendering
every token and primitive. That styleguide is the canvas the design phase dresses
(see §8).

---

## 3. Engine abstraction (parallel dev, no wasm dependency)

A single typed contract both implementations satisfy:

```ts
interface SimEngine {
  init(): Promise<EngineInfo>;       // threads, cores, version, crossOriginIsolated
  run(input: SimInput, onProgress: (p: Progress) => void): Promise<SimReport>;
  cancel(): void;
}
```

- `SimInput`/`SimReport` are **Zod schemas** modeled on simc's `.simc` input and
  `json2` output (DPS, ability breakdown, buff uptimes for v1).
- **`MockEngine`** (Phase U1): runs in a worker, fakes progress over a couple
  seconds, returns a realistic `SimReport` shaped from **captured real simc
  `json2` samples**, so the UI renders against true-shaped data.
- **`WasmEngine`** (later): same interface, hosts `simc.wasm` via Comlink, MEMFS
  in / `out.json` out.
- A factory + env flag selects the implementation. **Switching to the real engine
  is a one-line change**; all UI built against the mock keeps working.

---

## 4. Project structure

```
src/
  app/            # routes, providers, layout shell
  theme/          # tokens, semantic themes, tailwind cfg, ThemeProvider, styleguide
  ui/             # styled primitives (Button, Dialog, Tabs, Field, Tooltip…) on Radix
  engine/         # SimEngine interface, MockEngine, WasmEngine, schemas, worker glue
  features/
    quick-sim/    # paste box, run, report
    advanced/     # raw simc input editor (CodeMirror)
    sim-options/  # shared fight style/length/targets/precision controls
    report/       # report rendering + charts
    history/      # Dexie-backed run history
  lib/            # zod schemas, utils, crossOriginIsolated guard
```

---

## 5. Phased build — v1 (Phases 0 + 1 of `OVERALL_PLAN.md`)

> v1 ships running against `MockEngine` and has **no wasm dependency**. Swapping
> in the real engine (U5) is the final integration step once the fork lands.

**Phase U0 — Foundation & theming spine**
- Vite + React + TS scaffold; ESLint/Prettier.
- COOP/COEP: Vite dev headers + Cloudflare `_headers`; a runtime
  `crossOriginIsolated` guard component that surfaces a clear banner if
  isolation/threads are unavailable.
- **Theming system** (§2) end-to-end with one neutral placeholder theme + the
  styleguide route.
- App shell: layout, nav, route skeleton (TanStack Router).
- CI: lint + typecheck + token/arbitrary-value check; deploy preview to
  Cloudflare Pages.

**Phase U1 — Engine seam**
- `SimEngine` interface + Zod `SimInput`/`SimReport` schemas (from sample simc
  `json2`).
- `MockEngine` in a worker via Comlink, with progress + cancel.
- `EngineInfo` panel (cores, threads, isolation status).

**Phase U2 — Quick Sim flow**
- Paste `/simc` string → validate → run → live progress UI → cancel.
- Report render: **DPS headline, ability damage breakdown, buff uptimes** (table
  + first themed charts via visx).
- Error/empty/loading states, all themed.

**Phase U3 — Shared sim options + Advanced mode**
- Shared controls: fight style, target count, fight length, **precision**
  (`target_error`/iterations) — the perf lever, with honest "fast vs precise"
  framing.
- Advanced: raw simc input editor (CodeMirror) feeding the same engine path.

**Phase U4 — Report polish + local history**
- Richer themed report visualizations; export/copy.
- Dexie-backed run history (list, reopen, delete).

**Phase U5 — Real-engine integration (gated on the fork)**
- Implement `WasmEngine`, swap the factory flag, validate that the real
  `json2` report renders through the existing renderer. No UI changes expected.

---

## 6. Later phases (sketch only)

- **Gear (Phase 2 UI):** item DB load + Fuse.js search, slot-based item picker,
  gear-set editor, Top Gear/Gear Compare result tables + combinatorial-cap
  warnings. New `features/gear/`, reuses the engine seam (profileset inputs).
- **Droptimizer (Phase 3 UI):** loot-source browser (instance→encounter→items),
  per-drop delta table, EV/Best-Drop/Priority views. Heaviest data + aggregation
  UI.
- **Polish (Phase 4 UI):** Stat Weights view, report sharing (needs the optional
  CF Worker/API), Armory import form, settings, user-facing theme switcher.

All later phases inherit the same token system and engine seam — no architectural
change, just new `features/`.

---

## 7. Testing

**No tests are written for now.** This is a deliberate choice for the early build
phases to keep iteration fast while the structure and design are still in flux.
The architecture (typed engine seam, Zod schemas, separated behavior/style) keeps
the code testable so a test suite can be added later without restructuring. When
tests are introduced, the intended stack is Vitest + Testing Library (unit/
component against `MockEngine`) and Playwright (e2e), plus a smoke check that
`crossOriginIsolated === true` and the thread pool is sized to cores once
`WasmEngine` lands.

---

## 8. When UI design becomes a blocker

The whole point of the token + headless-primitive structure is that **design
landing late requires editing the token file + Tailwind theme + layout, not
rewriting components.** Concretely, against the design timeline:

**Can be built fully *before* any design exists (no blocker):**
- **Phase U0** — scaffolding, the theming *mechanism* + lint enforcement, CI,
  COOP/COEP, routing skeleton, and the **styleguide route**. (The styleguide is
  the artifact that *unblocks the designer* — it shows them the token surface to
  fill in.)
- **Phase U1** — the engine seam, schemas, `MockEngine`. Pure logic, zero design.
- **Phase U5** — real-engine integration. Pure logic, zero design.
- The behavioral layer of `ui/` primitives (Radix wiring) and `features/`
  data flow can be assembled with the neutral placeholder theme.

**Soft blocker — build functionally now, dress later:**
- **Phase U2 / U3** — the Quick Sim flow, sim options, and Advanced editor can be
  built end-to-end against the neutral placeholder theme and the mock engine.
  They *work* without design; they just aren't visually final. The one design
  input that genuinely helps here is the **information hierarchy / layout** of the
  sim form and the report (what's primary, grouping, ordering) — useful but not
  strictly required to make progress.

**Hard blocker — needs design before it's meaningful:**
- **Phase U4** — final report visualizations and overall look-and-feel sign-off.
  Chart styling, report information hierarchy, and the actual theme values are the
  payload of the design phase. Building polished charts before design risks rework.

**Bottom line:** we can start implementing meaningful work *immediately* —
Phases U0 and U1 — and carry U2/U3 a long way against the placeholder theme. The
design only becomes a true blocker at the **polish/U4** stage and for final
visual sign-off. The recommended sequence is therefore: build U0+U1, get the
styleguide in front of the designer to unblock them, build U2/U3 functionally in
parallel, then apply the design (theme values + layout) and finish U4.

---

## 9. Open items to revisit

- CodeMirror simc syntax highlighting — basic editor first; custom language mode
  is a later enhancement.
- Report schema fidelity — finalize `SimReport` against real `json2` samples as
  soon as the fork can emit them.
- Theme switcher exposure — mechanism built now, surfaced to users in Phase 4.
