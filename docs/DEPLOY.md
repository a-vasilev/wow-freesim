# Deploying the web app + hosting the engine wasm

This covers shipping the `web` app to **Cloudflare Pages** and hosting the 107 MB
`simc.wasm` on **R2**. The architecture rationale is in
[`WEB_UI_PLAN.md` §3.1](./WEB_UI_PLAN.md) and [`OVERALL_PLAN.md` §1/§6](./OVERALL_PLAN.md);
this is the operational checklist. Provisioning R2/Pages is an ops task — the app
side (config, build, headers) is already wired.

## The same-origin split (why two hosts)

The engine ships as two files from the pinned release (`simc-wasm v1205.01`):

| File | Size | Where it must live | Why |
|---|---|---|---|
| `simc.js` (ES6 glue) | ~80 KB | **same-origin** (Pages static asset at `/engine/<tag>/simc.js`) | The engine re-loads it as the `em-pthread` worker script, and worker scripts must be same-origin. |
| `simc.wasm` | ~107 MB | **cross-origin OK** (R2 custom domain) | Fetched once on the host thread and shared to pthreads via `postMessage` — exactly one cross-origin fetch. Pages enforces a 25 MiB per-file limit, so it *cannot* be a Pages asset. |

`manifest.json` carries the per-file sha256 used for integrity verification.

The pin + hashes live in [`src/engine/config.ts`](../src/engine/config.ts). Bumping
the engine = changing the tag + hashes there (decoupled from app redeploys —
`data patch == engine patch`).

## 1. Cross-origin isolation headers (already configured)

Multithreaded WASM needs `SharedArrayBuffer`, which needs the page cross-origin
isolated:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

`credentialless` (not `require-corp`) is deliberate: it keeps the page isolated
*and* lets the no-cors Wowhead tooltip script + icon CDN load without CORP headers.
Set in [`public/_headers`](../public/_headers) (prod) and `vite.config.ts` (dev).
A runtime `crossOriginIsolated` guard surfaces a banner if isolation is missing.

## 2. Build & deploy the app (Cloudflare Pages)

1. Fetch the engine artifacts into `.engine-cache/` (gitignored, never committed):
   ```sh
   node scripts/fetch-engine.mjs        # downloads + verifies sha256 vs manifest
   ```
2. Set the production env (Pages → Settings → Environment variables, or `.env`):
   ```sh
   VITE_ENGINE_WASM_URL=https://engine.<your-domain>/v1205.01/simc.wasm
   ```
   See [`.env.example`](../.env.example).
3. Build:
   ```sh
   npm run build
   ```
   The Vite plugin copies `.engine-cache/simc.js` → `dist/engine/v1205.01/simc.js`
   (vendored same-origin). It deliberately does **not** emit the wasm. If
   `.engine-cache/simc.js` is missing, the build warns and prod will 404 on the glue.
4. Deploy `dist/` to Pages (build command `npm run build`, output dir `dist`).
   `public/_headers` ships the COOP/COEP + immutable `/engine/*` cache rules.

## 3. Host `simc.wasm` on R2

1. Create an R2 bucket and upload the versioned artifact at a **tag-keyed** path:
   ```
   v1205.01/simc.wasm
   ```
   (Immutable per tag, so it caches forever.)
2. Expose the bucket via an **R2 custom domain** (e.g. `engine.<your-domain>`).
   A subdomain is cross-origin to the app — fine, because we fetch the wasm
   ourselves in **CORS mode**.
3. Configure **R2 CORS** so the bucket returns `Access-Control-Allow-Origin` for the
   app origin (this makes the response non-opaque, which `WebAssembly.instantiate`
   accepts under `COEP: credentialless`). Example policy:
   ```json
   [
     {
       "AllowedOrigins": ["https://<your-app-domain>"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
4. Set an immutable cache header on the object:
   `Cache-Control: public, max-age=31536000, immutable`.

The worker fetches the wasm with `fetch(url, { mode: 'cors' })`, caches the bytes
in the Cache API (keyed by the immutable versioned URL), and — in prod —
verifies the sha256 against `manifest.json` before instantiating
(`verifyIntegrity` is on for `PROD`; see `src/engine/config.ts` and `wasm-worker.ts`).

## 4. The cross-origin CORS-fetch proof (validate first)

The whole R2 path hinges on the cross-origin CORS-mode wasm fetch + instantiate
succeeding under our COOP/COEP headers. **Prove this before relying on it:**

1. Deploy the app and upload the wasm to R2 with the CORS policy above.
2. Open the deployed site, then `/dev/engine` (or run a real Quick Sim). On boot it:
   - confirms `crossOriginIsolated === true`,
   - fetches the cross-origin wasm (one request, CORS mode) — check the Network tab
     shows a `200` with `Access-Control-Allow-Origin` and **no CORS error**,
   - instantiates and runs a sim across multiple threads.
3. If the fetch is blocked (opaque response / CORS error / COEP rejection):
   - re-check the R2 CORS `AllowedOrigins` matches the exact app origin,
   - confirm the object is reachable and returns `ACAO`,
   - as a **fallback**, serve the wasm from a same-origin path via a Cloudflare
     Pages Function / Worker that streams from R2 (`/engine/<tag>/simc.wasm`) and set
     `VITE_ENGINE_WASM_URL` to that same-origin path. Robust, but adds a (read-only)
     Function and, at high traffic, Worker-invocation cost unless edge-cached. This
     is *not* the optional OAuth/sharing backend.

## 5. First-load UX

107 MB is a one-time, cacheable download. The engine loads **lazily** (only on the
first real run) behind a progress state, and the bytes are cached via the Cache API
keyed by the versioned URL, so a patch/tag bump invalidates cleanly.
