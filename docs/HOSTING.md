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
  `VITE_ENGINE_WASM_URL = https://engine.yourdomain.com` — just the R2 custom-domain
  **origin** (no tag, no filename). `src/engine/config.ts` appends `/<tag>/simc.wasm`
  for the pinned tag, so this var is set **once and never changes** across engine
  bumps — that's what makes the automated bump (below) hands-off. Unset in dev, where
  the Vite middleware serves the wasm from `.engine-cache/`. (A full tagged
  `…/<tag>/simc.wasm` URL is still honored for back-compat, but then you'd have to
  repoint it every bump — prefer the bare origin.)

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

Review the diff, commit, and let Pages deploy. No env-var change is needed —
`VITE_ENGINE_WASM_URL` is the tag-agnostic R2 origin and `config.ts` builds the
per-tag path from the new pin.

**Automated:** [`.github/workflows/engine-bump.yml`](../.github/workflows/engine-bump.yml)
uploads the wasm to R2 and **commits the glue + pin straight to `main`**. Cloudflare
Pages' Git integration sees the push and redeploys — there is no deploy step on our
side. Trigger it manually (workflow_dispatch with a tag) or have the simc fork's
release CI fire a `repository_dispatch` (`type: engine-release`,
`client_payload.tag`).

The wasm lands in R2 *before* the commit, so the redeploy's new pin always resolves
to bytes that already exist. `main` is protected by a ruleset, and the default
`GITHUB_TOKEN`'s `github-actions[bot]` **can't** be added to a ruleset bypass list —
so the workflow pushes using a **GitHub App** token instead (the App *is* a valid
bypass actor). Cloudflare's external Git webhook redeploys on the push regardless of
which token authored it.

Prerequisites (one-time):

- **Secrets** (web repo → Settings → Secrets and variables → Actions → *Secrets*):
  - `CLOUDFLARE_API_TOKEN` (needs **"R2 Storage: Edit"**) and `CLOUDFLARE_ACCOUNT_ID`.
  - `ENGINE_BUMP_APP_ID` + `ENGINE_BUMP_APP_KEY` — the App ID and private-key PEM of a
    GitHub App (e.g. `wow-freesim-engine-bot`) with **Contents: Read & write**,
    installed on this repo.
- **Variable** (same page → *Variables*): `R2_ENGINE_BUCKET` = `wow-freesim-engine`.
- **Ruleset bypass:** add that GitHub App to the `main` ruleset's **Bypass list**
  (ruleset → *Add bypass* → the App appears under apps), or the push step is blocked.

### Auto-trigger from the simc fork (optional)

For a release in the `simc-wasm` fork to bump this repo automatically, add a job to
the **fork's** release workflow that fires a `repository_dispatch` here. It needs a
**PAT** (fine-grained, scoped to `wow-freesim` with *Contents: read & write* and
*Metadata: read*, or a classic token with `repo`) stored as a secret in the **fork**
(e.g. `WEB_REPO_DISPATCH_TOKEN`):

```yaml
# In the simc-wasm fork's release workflow, after the release is published:
- name: Notify wow-freesim to bump the engine
  env:
    GH_TOKEN: ${{ secrets.WEB_REPO_DISPATCH_TOKEN }}
  run: |
    gh api repos/<owner>/wow-freesim/dispatches \
      -f event_type=engine-release \
      -F client_payload[tag]="${{ github.event.release.tag_name }}"
```

The default `GITHUB_TOKEN` **cannot** reach another repo — a separate PAT is
required. The tag must be `vNNNN.NN`; the workflow re-validates it and aborts on a
bad value, so a malformed release never reaches R2.

> The glue **must** stay same-origin, so it ships vendored in `public/engine/<tag>/`;
> the bump script prunes older `public/engine/v*` dirs so the repo pins exactly one
> tag. This only touches the local glue dirs — the 107 MB **wasm objects in R2 are
> never auto-pruned**; delete stale ones by hand (`wrangler r2 object delete`).
