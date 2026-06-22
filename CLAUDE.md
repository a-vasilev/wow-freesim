# CLAUDE.md

## What this is

`wow-freesim` (this repo = the **`web`** app) is a browser-based competitor to
Raidbots: it runs **SimulationCraft entirely client-side via WebAssembly**, so
WoW sims execute on the user's own CPU cores instead of a server farm. The site
stays lightweight and cheap/free to host — no sim queue, no per-sim server cost.

This repo is **only the React web UI**. Two sibling repos (not here):

- **`simc` fork** — SimulationCraft compiled to threaded WASM via Emscripten.
  Being built in parallel. **Do not depend on it yet** — the UI targets a typed
  `SimEngine` interface with a `MockEngine`, and the real `WasmEngine` is a
  one-line factory swap later.
- **`data`** — per-patch item/loot bundle pipeline (Phase 2+).

Full context: [`docs/OVERALL_PLAN.md`](./docs/OVERALL_PLAN.md) (product +
architecture), [`docs/WEB_UI_PLAN.md`](./docs/WEB_UI_PLAN.md) (this app's phased
build plan), and [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) (the approved
"Editorial Noir" visual design — tokens, typography, components, the WoW item
tooltip spec). Read these before substantial work.

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · Radix UI (headless) · Zustand ·
TanStack Router · Zod · CodeMirror 6 (advanced editor) · visx (charts) · Comlink
(worker) · Dexie (local history) · Fuse.js (item search, later). Hosted on
Cloudflare Pages.

## Non-obvious constraints (these shape everything)

- **Strict theming, zero stray styles.** Two-tier tokens: _primitive_ tokens
  (raw palette/scales, never used in markup) → _semantic_ tokens
  (`color-surface`, `color-accent`, …, the only thing components reference). A
  theme = a remap of semantic→primitive under `[data-theme]`. Tailwind v4
  `@theme` exposes **only semantic tokens** with the default palette stripped, so
  off-token classes (`text-blue-500`, `w-[137px]`) literally don't compile. Never
  hardcode a color/spacing/font value or use inline `style` (tiny allowlist for
  dynamic chart geometry only). The shipped theme is **"noir"** (Editorial Noir);
  values + usage live in [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) and
  `src/theme/` (the `/styleguide` route renders the live token surface). WoW
  item-quality and tooltip colors are **game constants** — never recolor them.
- **Engine is always behind the `SimEngine` seam.** Nothing in the UI imports
  wasm directly. Build/test against `MockEngine` (worker that returns real-shaped
  `json2` samples).
- **Cross-origin isolation is mandatory** for multithreaded WASM
  (`SharedArrayBuffer` needs COOP/COEP headers). Set via Vite dev headers +
  Cloudflare `_headers`; runtime guard checks `crossOriginIsolated`.
- **Headless components only** (Radix/React Aria) — we own 100% of styling. No
  pre-styled component libraries.
- **GPLv3.** The whole project is open source; no proprietary tier.

## Working notes

- **No tests for now** — deliberate (see WEB_UI_PLAN §7). Don't add a test suite
  unprompted.
- **Design has landed: "Editorial Noir".** The token system, typography, layout
  shell, and component specs are settled in
  [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) + `src/theme/`; reference
  screens are in `docs/mockups/` (`gear.html`, `report.html`). Build new UI
  against these tokens, not ad-hoc styles. Fonts are **self-hosted** via
  `@fontsource-variable/*` (CDN webfonts are blocked under COEP — see
  `src/main.tsx`).
- Platform is Windows; shell is PowerShell (Bash tool also available).
- Otherwise standard Vite/React conventions — no need to document routine
  commands here.
