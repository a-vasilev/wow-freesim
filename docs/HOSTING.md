# Hosting (Cloudflare Pages + R2)

How `wow-freesim` is deployed: a **static site on Cloudflare Pages**, with the
107 MB `simc.wasm` served from **R2** via a custom domain. See
[`WEB_UI_PLAN.md`](./WEB_UI_PLAN.md) §3.1 for the architectural rationale.

## The split (what lives where, and why)

| Artifact | Size | Location | Origin | Why |
|---|---|---|---|---|
| App build (`index.html`, JS/CSS) | small | Pages | same-origin | normal static site |
| `simc.js` (engine glue) | ~80 KB | Pages (`public/engine/<tag>/`) | **same-origin** | pthread workers re-load it as a worker script — cross-origin worker scripts are blocked |
| `simc.wasm` | 107 MB | **R2** + custom domain | cross-origin | exceeds Pages' 25 MiB/file limit; fetched once in CORS mode |

The page is **cross-origin-isolated** (`COOP: same-origin` + `COEP: credentialless`,
set in [`public/_headers`](../public/_headers)) so `SharedArrayBuffer` — and thus the
threaded WASM pool — is available. `credentialless` only strips credentials from
*no-cors* subresources; the explicit CORS fetch of the wasm (with an
`Access-Control-Allow-Origin` header from R2) is unaffected, and the cross-origin
Wowhead tooltip script/icon CDN still load.

## One-time setup

### 1. R2 bucket + custom domain

```bash
wrangler r2 bucket create wow-freesim-engine
```

Dashboard → **R2 → bucket → Settings → Public access → Custom domains** → add e.g.
`engine.yourdomain.com`. This serves objects directly, **no Worker in the path**.
The wasm then lives at `https://engine.yourdomain.com/<tag>/simc.wasm`. (Avoid the
`r2.dev` dev URL in production — it's rate-limited.)

### 2. R2 CORS policy

R2 → bucket → Settings → **CORS policy**. List **every** origin the app is served
from (the `*.pages.dev` deploy URL and your apex domain):

```json
[
  {
    "AllowedOrigins": ["https://wow-freesim.pages.dev", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

This gives the **non-opaque** response `loadWasmBytes()` (in
[`src/engine/wasm-worker.ts`](../src/engine/wasm-worker.ts)) needs — it fetches with
`mode: 'cors'`.

### 3. Pages project

Connect the Git repo. Build settings:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- `public/_headers` is copied into `dist/` automatically (COOP/COEP site-wide).
- **Environment variable (Production):**
  `VITE_ENGINE_WASM_URL = https://engine.yourdomain.com/v1205.01/simc.wasm`
  (read by `src/engine/config.ts`; unset in dev, where the Vite middleware serves
  the wasm from `.engine-cache/`). The bump workflow updates the tag in this URL —
  keep the env var's tag in sync, or point it at a `/latest/` alias you repoint.

### 4. Verify after deploy

1. Console: `crossOriginIsolated === true`.
2. `/dev/engine` → run a sim. Network tab shows **one** cross-origin `simc.wasm`
   fetch (200, with `access-control-allow-origin`), then the pthread pool comes up
   and progress streams. Hang at 0% ⇒ missing CORS header or non-isolated page.
3. `verifyIntegrity` is on in prod, so a wrong/corrupt upload fails against the
   pinned sha256.

## Bumping the engine (Strategy A: CI bump + auto-deploy)

The engine version is **pinned at compile time** in `src/engine/config.ts` (tag +
sha256), so each version is a fast static redeploy — but the redeploy is
**automated**, not manual.

**Manual / local:**

```bash
node scripts/bump-engine.mjs v1206.02   # vendors glue + rewrites the pin
# then upload the wasm to R2:
wrangler r2 object put wow-freesim-engine/v1206.02/simc.wasm \
  --file .engine-cache/simc.wasm --remote \
  --content-type application/wasm \
  --cache-control "public, max-age=31536000, immutable"
```

Review the diff, commit, update `VITE_ENGINE_WASM_URL`'s tag, and let Pages deploy.

**Automated:** [`.github/workflows/engine-bump.yml`](../.github/workflows/engine-bump.yml)
does all of the above and opens a PR. Trigger it manually (workflow_dispatch with a
tag) or have the simc fork's release CI fire a `repository_dispatch`
(`type: engine-release`, `client_payload.tag`). Requires repo secrets
`CLOUDFLARE_API_TOKEN` (R2 Storage: Edit) + `CLOUDFLARE_ACCOUNT_ID` and the var
`R2_ENGINE_BUCKET`. Merging the PR deploys.

> The glue **must** stay same-origin, so it ships vendored in `public/engine/<tag>/`
> (the bump script prunes older tags). Only the wasm goes to R2.
