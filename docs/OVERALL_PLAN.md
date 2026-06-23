# Browser SimC — Project Plan (v0.1)

A browser-based competitor to Raidbots: run SimulationCraft entirely in the
user's browser via WebAssembly, so simulations execute on the user's own CPU
cores instead of a server farm. The site stays lightweight and cheap-to-free to
host, with no sim queue and no per-sim server cost.

---

## 1. Goals & constraints

**Vision.** Feature parity with Raidbots' core sim types, but with the compute
moved client-side. Import a character (paste the `/simc` addon string), run a
sim, get a report — all locally.

**Hard constraints (non-negotiable, shape everything):**

- **GPLv3.** SimC is GPLv3 strong copyleft. The moment we ship a simc-derived
  `.wasm` to a browser, we are *distributing* the binary, so copyleft attaches.
  Conservative reading: the whole app is GPLv3. **Consequence: open-source the
  entire project; no proprietary premium tier.** Monetize, if at all, via
  donations / optional hosted convenience. (This is also *why* Raidbots runs
  simc server-side — they never distribute the binary, so their frontend stays
  closed. We're deliberately flipping that tradeoff.)
- **Cross-origin isolation is mandatory.** Multithreaded WASM needs
  `SharedArrayBuffer`, which needs the page served with
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: credentialless`. No isolation → no threads → sim
  is unusably slow. **We use `credentialless` rather than `require-corp`
  deliberately:** it keeps the page isolated *and* lets cross-origin no-cors
  subresources (the Wowhead tooltip script + icon CDN) load without CORP headers —
  the mechanism behind our zero-bundle item/spell display (§6). Verified working
  with `SharedArrayBuffer` live in Chrome/Edge/Firefox (Firefox default-on since
  119).
- **The data treadmill.** SimC bakes WoW game data into the binary, regenerated
  every patch (currently 12.0.7). "Update for the new patch" = rebuild the wasm
  from the new upstream tag + regenerate the data bundles. This must be
  automated or the project dies within a season.

**Closed decisions (settled, with rationale — don't relitigate):**

| Decision | Choice | Why |
|---|---|---|
| Compute target | **CPU multicore WASM, not GPU** | SimC is a branchy, event-driven OO state machine → catastrophic warp divergence on SIMT. It maps to MIMD (CPU cores), which is why it already scales near-linearly across threads. GPU would be slower *after* an endless rewrite. |
| Toolchain | **Emscripten, not WASI-SDK** | Only mature path for threaded C++ *in a browser*. WASI/Component Model/WasmGC target server/edge/GC-languages, not our case. |
| Data delivery | **Pre-built static bundles, not live API calls** | Blizzard API needs OAuth secrets (can't live in browser) + has rate limits. Loot data is slow-changing. Pre-build in CI, ship static. |
| Fork strategy | **Fork simc, keep a small `wasm` branch, rebase onto pinned retail-branch commits** | simc doesn't tag/release the engine — retail data lands as a continuous commit stream. Pin to a chosen commit SHA for reproducibility; plain-git overlay (normal commits, no patch files). Per-patch update is `git rebase <new-sha>` + CI build, not a manual merge war. |

---

## 2. Feature scope (parity target)

Ranked easiest → hardest, which is also a sane build order:

1. **Quick Sim** — single DPS number + ability damage breakdown + buff uptimes.
   Paste `/simc`, run, render. *No extra data needed.* → the "hello world."
2. **Advanced** — raw SimC input/options sandbox. Almost free once Quick Sim
   works (just expose the raw config).
3. **Stat Weights** — simc computes natively. Easy. Include the "you probably
   shouldn't use these" framing the community has adopted.
4. **Gear Compare** — compare specific gear sets. Needs item picker + item DB.
   Raidbots calls it legacy; do minimally or fold into Top Gear.
5. **Top Gear** — item search + try-all-combinations to find the best. Needs item
   DB + picker + profileset generation over combinations (watch combinatorial
   blowup).
6. **Droptimizer** — test every possible drop from a source vs current gear, one
   piece at a time. Hard, **not because of simc** but because it needs the full
   seasonal loot-source database + the Expected Value / Best Drop / Priority
   aggregation.

**Shared sim options** across all types: fight style (Patchwerk, DungeonSlice,
HecticAddCleave, …), target count, fight length, and a precision control. The
precision knob is just simc's `target_error` / iteration count — and it doubles
as our main performance lever.

---

## 3. System architecture

Five components; only the first three are needed for an MVP.

```
[ UI thread / React ]
        │  (Comlink)
        ▼
[ Orchestration Web Worker ]
        │  hosts
        ▼
[ simc.wasm module ] ──spawns──► [ pthread pool across N cores ]
        ▲
        │  static fetch (lazy)
[ Data bundles: loot.json, talents.json, item-index ]  ← published per patch
        ▲
        │  embed / hot-link, no auth
[ Wowhead tooltip script + icon CDN ]  ← item/spell display at runtime
```

**1. Engine artifact (`simc.wasm` + JS glue).** simc compiled with Emscripten,
real multithreading, driven CLI-style. Published as a *versioned release
artifact / npm package* — the app consumes it; the build is decoupled. (Detail
in §5.)

**2. Orchestration worker.** A single Web Worker hosts the wasm module, which
internally spawns its own pthread pool. **Key simplification:** simc's native
**profileset** feature runs a base profile + N variations as one parallelized
batch. Top Gear and Droptimizer are both just profileset batches. So JS never
manages parallelism or hundreds of separate sims — it *generates the profileset
text* and runs simc once. (Detail in §7.)

**3. Frontend.** React + TypeScript + Vite. Vite handles worker/wasm bundling and
the COOP/COEP dev headers. Builds simc input, talks to the worker via Comlink,
renders the JSON report.

**4. Data layer.** Static, versioned, lazy-loaded bundles for the item picker and
Droptimizer sources. (Detail in §6.)

**5. Optional thin backend.** The core sim loop needs **zero backend**. Two parity
features break that: Armory import by character name (needs Battle.net OAuth →
secret-holding token broker) and shareable report links (needs storage). Both
fit a free-tier Cloudflare Worker + KV/R2. Note Droptimizer/Top Gear with bag
items require the `/simc` string anyway (Armory doesn't expose bags), so Armory
import is convenience, not core.

**Hosting.** Cloudflare Pages (free static hosting + `_headers` for COOP/COEP +
same-account R2/KV/Workers if/when we add the backend). `coi-serviceworker` is
the fallback for hosts that can't set headers.

---

## 4. Repositories

Two active repos (+ one optional later). The engine fork owns both the build *and*
the game-data export; the app consumes the results. **There is no separate `data`
repo** — the Wowhead decision (§6) removed the item/spell *display* pipeline that
would have justified one, and what's left is either an additive byproduct of the
fork's build or a small web-repo job.

- **`simc` (your fork)** — a fork of `simulationcraft/simc` with your changes as
  **ordinary commits on a `wasm` branch** (no patch files). Holds the small
  engine-source delta (Emscripten build target + `#ifdef __EMSCRIPTEN__` tweaks)
  *and* the Emscripten toolchain files + CI. Daily work is plain git. Per-patch
  update is `git rebase <new-base-sha> wasm` (see §4 mechanics). CI builds from the
  pinned base commit, runs validation diffs vs native simc, and publishes a
  versioned **engine-data bundle**: `simc.wasm` + `talents.json` + `item-index.json`.
  The latter two are extracted **read-only** from simc's own baked data by an
  additive CI script (**new files, never source edits → the rebaseable delta is
  unchanged**; see §5). Bundling them with the wasm makes `data patch ==
  engine patch` automatic. (Split the build into its own repo later only if you hit
  a concrete reason — you won't for a long while.)
- **`web`** — the React/TS app. Consumes the published engine-data bundle. Where
  most ongoing feature work lives. At **Phase 3** it also hosts the **Droptimizer
  loot pipeline** — a scheduled CI job hitting the Blizzard Journal API →
  `loot.json` — the one dataset not derived from simc.
- **`api`** *(optional, later)* — Cloudflare Workers for Armory OAuth + report
  sharing.

**Fork mechanics & how simc actually ships.** simc does **not** tag or cut
GitHub releases on the engine repo — the Releases page is empty and the only git
tags are a dead pre-2015 convention. Retail data lands as a *continuous stream
of commits* on the current retail branch (`midnight` / `thewarwithin`-style),
including automated `data-update-live-*` commits. Real version numbers
(`12.0.7-01`) live only on the separate `simc-addon` repo, which you don't
rebase onto. So:

- **Pin to a commit SHA on the retail branch**, not a tag — that's your
  reproducible base with a known game-data state. Optionally drop your *own* tag
  on it (`git tag base-12.0.7 <sha>`) just for readability.
- Keep `upstream` as a remote; keep your delta as a few logical commits on
  `wasm`; **rebase, don't merge**, so history stays "my N commits on top of base
  SHA X" — your at-a-glance check that the delta is staying small.
- **Routine per-patch update:** `git fetch upstream` → pick a newer base commit
  (prefer a `data-update-live-*` point or branch HEAD at a moment of your
  choosing, not a random intermediate commit) → `git rebase <new-sha> wasm` →
  record the SHA → let CI build + validation-diff. If a pinned SHA lands
  mid-data-update and fails the sanity sims, bump to a slightly later commit.
- **`--onto` is only for the yearly expansion switch**, when the retail branch
  changes (e.g. `midnight` → next expansion) and history forks:
  `git rebase --onto <new-expansion-sha> <old-base-sha> wasm`. For ordinary
  patch-to-patch, plain `git rebase <new-sha> wasm` is enough.

GitHub-fork vs. your-own-copy is taste, not function (you're not upstreaming, so
the one-click-PR advantage is moot). When forking, copying just the current
retail branch is fine — `upstream` gives you anything else on demand.

**Versioning rule:** `data patch == engine patch`. A Droptimizer referencing an
item the bundled simc doesn't model is a broken sim. On patch day you'll usually
bump engine + data (and often app) together.

Everything is GPLv3.

---

## 5. Deep dive A — simc → WASM compilation

### Verdict

Emscripten, full stop, for this target. The 2024–2026 WASM advances (Wasm 3.0,
WASI 0.3 async I/O, WasmGC, Component Model) are real but aimed elsewhere:
server/edge runtimes and GC languages. Our job — an existing **threaded C++**
codebase running **in a browser** — is exactly Emscripten's home turf (Figma's
C++ engine, ffmpeg.wasm, etc.).

The decisive factor is **threading**: Emscripten has mature browser pthreads
(Web Workers + SharedArrayBuffer); the WASI threads path is experimental,
browser-unfriendly, and landed for C before C++. Our entire value prop is
multicore Monte Carlo, so the mature threading path wins decisively.

### Build setup

- **Build only `engine/`** (the CLI). Skip the Qt GUI entirely.
- **Toolchain:** `emcmake cmake` over simc's CMake.
- **Core flags:**
  - `-pthread` — real threads via Web Workers (compile *and* link).
  - `-msimd128` — WASM SIMD.
  - `-O3` + `wasm-opt` for release.
  - `-fwasm-exceptions` — native Wasm exception handling (simc uses C++
    exceptions; avoid the slow/large legacy emulated path).
  - `-sPROXY_TO_PTHREAD` — run the sim off the UI thread.
  - `-sPTHREAD_POOL_SIZE=<n>` — size to `navigator.hardwareConcurrency`.
  - `-sALLOW_MEMORY_GROWTH` (or a sized `INITIAL_MEMORY`).
  - `-sMODULARIZE -sEXPORT_ES6` — clean ES import into Vite.
  - `-sENVIRONMENT=web,worker`.

### Driving simc (don't over-engineer the interface)

Treat it like the CLI you already know. Use Emscripten's in-memory filesystem
(MEMFS):

1. Write the user's profile + options into a `.simc` file in MEMFS.
2. Run `main()` with args including `json2=out.json`.
3. Read `out.json` back out — simc's native JSON report is your render input.

No embind API needed for v1.

### Engine-source delta against upstream

Keep the delta tiny — it's what keeps per-patch updates to a quick rebase. Expect
changes in:

- **Build system** — simc's CMake file-globbing needs handling for the emcc
  link; possibly explicit source lists for the wasm target.
- **Threading / platform bits** — any spots touching raw `std::thread` or
  platform-specific code. Unlike the 2018 port, we **keep** real threading
  rather than stubbing it (browser pthreads are mature now).

These live as a few ordinary commits on your fork's `wasm` branch (see §4). On a
new patch: `git fetch upstream`, pick a newer base commit on the retail branch,
then `git rebase <new-sha> wasm`, resolve the (small) conflicts, record the SHA,
let CI build. No tags from upstream to chase, no patch files — just git.

**The game-data export is *not* part of this delta.** Emitting `talents.json` /
`item-index.json` (§4, §6) is a **read-only** job: an additive CI script + workflow
in **new files** (a `tools/` dir, a workflow YAML) in directories upstream never
touches, reading simc's already-generated data — and it can piggyback on the native
simc build CI already makes for the validation diff, so no extra build. `git rebase`
replays new-file commits cleanly, so the export adds **~zero rebase risk**; it needs
only a *script edit* (never a merge) in the rare case simc/Blizzard changes a data
*schema*. The fork's rebaseable delta stays exactly the build + threading tweaks
above — adding the data export does **not** make the fork heavier to maintain.

### Binary size

simc + baked game data compiles to a large `.wasm` (tens of MB). It's a one-time
download, cacheable. Mitigate with `-O3`/`wasm-opt`/symbol stripping; revisit
data-splitting only if first-load is a real problem.

### Optional: keep a `wasm32-wasi` build in your back pocket

If you later want the *same* binary to run server-side (e.g. an optional
edge-hosted sim on Cloudflare/Wasmtime for phone users who can't run big sims
locally), a parallel `wasm32-wasi` build is portable across server runtimes.
Don't build this for v1; just don't architect anything that precludes it.

### CI

GitHub Actions: on a push to `wasm` (i.e. after you rebase onto a new base
commit) → rebuild wasm → run a battery of sims → **diff DPS output against native
simc** to catch porting regressions → publish artifact. Without the validation
diff, a silent numerical regression ships. With it, "update for the new patch" is
mostly a green checkmark.

---

## 6. Deep dive B — data pipeline

### Stop treating "the data" as one thing — it splits by *who provides it*

Four layers, and only the last is a pipeline we meaningfully maintain. **Decision
(settled): we never build or maintain our own item/spell *display* database — not
now, not long-term. Wowhead provides all display data at runtime.**

1. **Sim correctness → baked into `simc.wasm`.** simc bakes ItemSparse, spell
   coefficients, talent effects, and set bonuses into the binary; that's how it
   sims. For sim *correctness* you fetch nothing, ever.
2. **Item/spell *display* (names, icons, quality, full stat tooltips) → Wowhead,
   at runtime. No bundle.** This is the big change from v0.1. The raw `/simc`
   string and `json2` report carry only **IDs** (item + bonus + gem + enchant ids;
   spell ids in the ability breakdown). We hand those IDs to **Wowhead's "Power"
   tooltip script** (`wow.zamimg.com/js/tooltips.js`) and **icon CDN**, which
   render the icon and the full game-authentic tooltip — items *and* spells,
   including enchants and gems. Crucially, the item `bonus=`/`ilvl=`/`gems=`/`ench=`
   params map **directly** from a simc item string, so customized items (Top
   Gear / Droptimizer candidates the player doesn't own) tooltip correctly too.
   - Works on an isolated page **only because COEP is `credentialless`** (§1); a
     plain no-cors `<script>`/`<img>` is exempt from the CORP requirement there.
     Empirically verified with `SharedArrayBuffer` live.
3. **Structural data Wowhead's embed can't provide → derived from simc, small.**
   The embed is *display-by-ID*; it provides neither a **talent-tree layout**
   (nodes / positions / edges / max-ranks per class, spec, hero tree) nor a
   **searchable item catalog** (needed for "add an item I don't own" in Top Gear —
   the embed has no bulk search, and scraping Wowhead's search is out). Both are
   emitted by an **additive, read-only script in the fork's CI** — *not* a source
   patch and *not* a hand-maintained parallel DB, so the fork stays trivially
   rebaseable (§5). `item-index.json` is a clean simc byproduct (simc bakes the item
   tables). The talent-tree *layout* (node x/y + edges) comes from simc's trait data
   **if it carries positions/edges**, else from Blizzard's Talent Tree API — either
   way a read-only CI script, never a fork source change. **Not a Wowhead
   replacement:** selected talents come from `inspect()`, item *display* from
   Wowhead; only the tree *shape* and the *search list* come from here.
4. **Loot-source tables (what drops where, by difficulty) → Blizzard Journal API,
   prebuilt. Droptimizer only (Phase 3).** The one genuinely maintained dataset.
   Authoritative source: Blizzard Game Data **Journal APIs** (journal-instance →
   journal-encounter → per-encounter items, with difficulty / item-level context)
   — exactly Droptimizer's input shape. **The long tail** (vendors, crafting, PvP,
   events) isn't fully in the Journal — stitching those in is the laborious part
   that makes this a maintained pipeline, not a one-off export. Wowhead never
   offered this in embeddable form, so it's a different dataset, not a display
   substitute.

### For the data we *do* build (layers 3–4): pre-build static bundles, NOT live API calls

This applies to **Blizzard-sourced loot tables and the simc-derived structures** —
*not* to display data. (Display is live Wowhead, which is fine: it's public, needs
no auth, is rate-friendly per-item-on-hover, and is the universal practice — see
*Licensing & etiquette* below.) For the Blizzard/structural data:

| Reason | Detail |
|---|---|
| **Auth forces a backend anyway** | Blizzard Game Data needs OAuth client credentials; the secret can't live in the browser. A *runtime* call needs a token-broker proxy — reintroducing the server we're avoiding. Pre-building moves auth to CI, where the secret sits in GitHub Actions secrets. |
| **Rate limits** | ~36k req/hour (+ ~100/sec) per client, enforced with 429s. Every user's Droptimizer hitting Blizzard live would exhaust the shared quota instantly. Pre-build hits the API once per patch. |
| **Data barely changes** | Loot tables move on patch/season boundaries, not minute-to-minute. No freshness benefit to live calls. |
| **Control** | Validate, fix the vendor long-tail, ship a known-good snapshot in CI — instead of exposing every user to live API quirks. |

### Pipeline shape

Two producers, no separate `data` repo (§4):

**Engine-data bundle (simc fork CI):** alongside the wasm build, a read-only script
extracts `talents.json` + `item-index.json` from simc's own baked data → publish
**versioned with the wasm** (`<patch>/talents.json`, `<patch>/item-index.json`), so
data patch == engine patch automatically.

**Loot pipeline (web repo CI, Phase 3):** authenticate to Blizzard's Journal API
(and/or pull wago.tools for the long tail) → extract instances/encounters/items →
normalize into a compact **versioned** `<patch>/loot.json` → publish as a static
asset (Cloudflare Pages asset or R2, edge-cached, ETag'd).

**Runtime (app):** lazy-load only what a screen needs (Quick Sim needs none — its
talent grid uses the engine bundle's `talents.json` and otherwise falls back to a
flat list; load the Droptimizer dataset only when that tab opens — preserves the
lightweight promise) → populate pickers / source lists → generate simc profileset
input from the selection. **Item/spell display + icons come from Wowhead at
runtime** (no bundle), not from these files.

**Only inherently-live call:** optional Armory character import by name (Profile
API, per-user, via the token broker). Everything else is static.

### Format & in-app use

- The **item search index** (layer 3 — id / name / slot / ilvl / icon-name /
  valid bonus options, enough to search and to synthesize a simc item string) is a
  few MB → plain JSON + a client-side search index (Fuse.js or a prebuilt inverted
  index). It is the *search list only*; the rich tooltip on each result is still
  rendered by Wowhead from the item id. Derived automatically from simc's baked
  data, not hand-curated.
- If it grows large and you want indexed queries → a prebuilt SQLite queried via
  a wasm SQLite build.
- **Decouple data from app releases:** hosting bundles on Cloudflare/R2 lets you
  publish a new patch's data by pointing the app at the new version, no full
  redeploy.

### Licensing & etiquette

- **Wowhead tooltips + icon CDN** are our display layer. Embedding the "Power"
  script and hot-linking `wow.zamimg.com` icons is the **intended, universal**
  use (Wowhead promotes it; the icon CDN sends `Access-Control-Allow-Origin: *`).
  Show a visible "Item & spell data from Wowhead" attribution. The script fetches
  tooltip data **per-item, on hover** (cached client-side), which is rate-friendly.
  **Do not bulk-scrape Wowhead** to pre-build a database — that's both against
  form and the thing we've decided not to do anyway.
- **Read Wowhead's ToS once before public launch** to confirm the
  data-reuse/attribution terms for the embed (the script path is the
  clearly-endorsed use).
- Game data is Blizzard's. The Journal/loot pipeline uses their API under ToS
  (attribution, fan-content rules) — the clean path. wago.tools, if used to
  cross-check the simc-derived structures, is a community service: pull in CI,
  cache, don't hammer per-user.
- Don't depend on Raidbots' own internal/undocumented data files: fragile and
  bad form. Own the built pipeline from authoritative sources.

---

## 7. Profileset generation (the connective tissue)

How a user's selection becomes a simc input batch. This is where the data layer
meets the engine.

- **Top Gear:** user selects candidate items per slot → generate one profileset
  per *combination* → simc runs the batch, returns DPS per profileset → rank.
  **Combinatorial blowup is the risk** (a few options across several slots
  explodes fast). v1 mitigations: cap total profilesets, warn on large
  selections, and lean on the precision toggle. (Raidbots' "Smart" gear handling
  prunes obviously-dominated sets — a later optimization.)
- **Droptimizer:** for a chosen source, generate one profileset per candidate
  drop, each swapping a single item vs current gear (rings/trinkets tried in
  both slots; dual-wield weapons in both). simc returns per-item DPS deltas; the
  app computes Expected Value (avg % upgrade, worse-than-current counts as 0),
  Best Drop, and Priority.
- Both feed the **same** profileset mechanism; only the input generation +
  result aggregation differ.

*(This is the natural "next detail" to expand once v1 runs.)*

---

## 8. Tech stack summary

| Layer | Choice |
|---|---|
| Sim engine | C++ simc → Emscripten → WASM (threaded, SIMD) |
| Engine I/O | MEMFS files + simc `json2` output |
| Frontend | React + TypeScript + Vite |
| Worker comms | Comlink over a Web Worker |
| Item search | JSON + Fuse.js (or prebuilt SQLite via wasm SQLite if large) |
| Local history | IndexedDB (Dexie) |
| Hosting | Cloudflare Pages (`_headers` → `COOP: same-origin` + `COEP: credentialless`) |
| Optional backend | Cloudflare Workers + KV/R2 (Armory OAuth, report sharing) |
| Display data | Wowhead "Power" tooltip script + icon CDN — item/spell/enchant/gem, at runtime, no bundle |
| Built data | Blizzard Journal API (loot, Phase 3) + simc-derived talent-tree & item-search index |
| CI | GitHub Actions (wasm rebuild + validation diff; data regen) |

---

## 9. Performance budget & UX implications

This is the honest tradeoff of client-side compute.

- **Quick Sim** (one profile): seconds. Fine everywhere.
- **Stat Weights** / small Gear Compare: seconds to a minute.
- **Top Gear / Droptimizer** (hundreds of profilesets): minutes on a strong
  desktop, painful on a weak laptop, effectively **out on phones** for big runs.
- **Levers:** the precision toggle (`target_error`), profileset caps, real
  progress UI, and an honest "fast vs precise" mode. Don't pretend to match a
  server farm — set expectations.
- **(Later option):** the optional `wasm32-wasi` server build for an opt-in
  edge-hosted heavy/mobile path.

---

## 10. Roadmap

CI automation runs from **Phase 0**, not bolted on later.

- **Phase 0 — Spine.** simc compiling to wasm from the current branch; run a
  pasted `/simc` Quick Sim in a worker; render the JSON report. Cross-origin
  isolation set up. Proves the whole thing end-to-end.
- **Phase 1 — Useful tool.** Quick Sim + Advanced + shared sim options
  (fight style, length, targets, precision). Near-zero data dependencies. Ship
  something real.
- **Phase 2 — Gear.** Item DB + picker; Top Gear + Gear Compare; profileset
  generation for combinations.
- **Phase 3 — Droptimizer.** The seasonal loot-source pipeline + Droptimizer +
  EV/Priority aggregation. Its own sub-project.
- **Phase 4 — Polish.** Stat Weights, local history (IndexedDB), report sharing,
  Armory import.

---

## 11. v1 definition (what to build first)

**v1 = Phase 0 + Phase 1.** Concretely:

- Your simc **fork** (`wasm` branch) builds a threaded, SIMD wasm artifact from
  a pinned retail-branch commit, with a CI job that produces it and runs at least
  one validation-diff sim vs native simc.
- `web` app: paste a `/simc` string → pick fight style / length / targets /
  precision → run in the worker → render DPS + ability breakdown + buff uptimes
  from the JSON report.
- Served cross-origin-isolated (Vite dev headers + Cloudflare `_headers`),
  threads confirmed active (`crossOriginIsolated === true`, pool sized to cores).
- Plus the Advanced raw-input mode (cheap once Quick Sim works).

**Explicitly NOT in v1:** no item DB, no Top Gear, no Droptimizer, no loot
pipeline, no backend, no Armory import, no sharing.

**First concrete steps:**

1. Fork simc (current retail branch); branch `wasm` off a pinned commit SHA, get
   `emcmake` building the `engine/` target, iterating flags until a trivial sim
   runs under Node.
2. Get a threaded build running a Quick Sim from a `.simc` file in MEMFS,
   emitting `out.json`.
3. Minimal Vite + React app: worker hosting the module, paste box, run button,
   JSON report render. Verify `crossOriginIsolated` and multi-core usage.
4. Wire the GitHub Actions build + validation diff.

---

## 12. Open questions / things to dig into next

- Profileset generation strategy + combinatorial caps (§7) — the natural next
  deep-dive once v1 runs.
- Exact engine-source delta against upstream — discover empirically during
  Phase 0.
- First-load binary size — measure before optimizing.
- Loot long-tail (vendors/crafting/PvP/events) — scope when Phase 3 starts.
- GPL specifics — a real read before public launch (not legal advice here).