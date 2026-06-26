# Armory import (Blizzard API)

Lets a user import a character by **region + realm + name** instead of pasting a
`/simc` string. The flow is:

```
ArmoryImportForm  →  GET /api/armory?region&realm&name  (same-origin Pages Function)
                        ├─ mints a Blizzard app token (client_credentials)
                        └─ relays 3 public profile endpoints
                  →  fetchArmoryProfile()  (zod-validates the payload)
                  →  toSimcProfile()        (pure JSON → .simc string)
                  →  useActiveDraft.setBase(profile)   (existing inspect→run→save pipeline)
```

The simc string is built **client-side** (`src/features/characters/armory/
toSimcProfile.ts`). The Pages Function (`functions/api/armory.ts`) is auth proxy +
relay only — it never assembles a profile and never sees the SimEngine seam. The
Blizzard secrets are read **only** inside the Function from `env`; they never reach
the client bundle (no `VITE_` prefix).

## 1. Create a Blizzard API client

1. Sign in at <https://develop.battle.net/access/clients> and **Create Client**.
2. Note the generated **Client ID** and **Client Secret**. The Armory profile
   endpoints used here need only the default `client_credentials` app token (no
   user OAuth / redirect URL required).

## 2. Configure the Pages environment (Production + Preview)

In Cloudflare Pages → your project → **Settings → Environment variables**, add the
following as **encrypted** vars to **both** Production and Preview:

| Name | Value |
|---|---|
| `BLIZZARD_CLIENT_ID` | the client id from step 1 |
| `BLIZZARD_CLIENT_SECRET` | the client secret from step 1 |

Do **not** prefix these with `VITE_` — that would inline them into the client
bundle. Pages Functions read them from the `env` binding at request time.

## 3. Run locally

`functions/` is served by Wrangler's Pages dev server, which also applies
`public/_headers` (COOP/COEP) and proxies `/api/*` to the Function:

```sh
# 1. provide local secrets (gitignored)
cp .dev.vars.example .dev.vars   # then fill in BLIZZARD_CLIENT_ID / _SECRET

# 2. build the app, then serve dist/ + functions/ together
npm run build
npx wrangler pages dev dist
```

`wrangler` is **not** a project dependency and the app's `npm run build` does **not**
depend on it — it's only needed to exercise `/api/armory` locally (`npx` pulls it on
demand). The pure transform and the form can be developed with the normal `npm run
dev` Vite server; only the live Function call needs Wrangler.

Without `.dev.vars` (or the Pages env vars in prod), `/api/armory` returns a `500`
with a clear *"Armory import is not configured on the server"* message — by design,
so a missing-creds setup fails obviously rather than silently.

## Notes / limitations

- **Talents are gear-only for now.** Blizzard's `specializations` endpoint stopped
  returning the talent loadout import string in patch 11.2 and still omits it. The
  transform probes for it and emits `talents=<code>` if it ever reappears; until
  then the UI shows a non-blocking notice telling the user to paste `/simc` for
  talents. No code change is needed when Blizzard restores the field.
- Only characters that have **logged in recently** appear on the Armory; an unknown
  character returns a `404` with that explanation.
- The app token is cached **in-isolate** (not via the Cloudflare Cache API across
  isolates) — see the comment in `functions/api/armory.ts`.
