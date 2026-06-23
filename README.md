# wow-freesim (`web`)

Browser-based competitor to Raidbots: runs **SimulationCraft entirely
client-side via WebAssembly**, so sims execute on the user's own CPU cores. This
repo is the **React web UI**. See [`CLAUDE.md`](./CLAUDE.md) and
[`docs/`](./docs) for full context and the phased build plan.

> **Status:** Phase U0 (foundation & theming spine). No real sim engine yet —
> the UI targets a typed `SimEngine` seam (Phase U1+).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 (token-driven) · TanStack Router
(file-based) · Zustand. See [`docs/WEB_UI_PLAN.md`](./docs/WEB_UI_PLAN.md) for
the full list and rationale.

## Develop

```bash
npm install
npm run dev        # Vite dev server (sets COOP/COEP headers for SharedArrayBuffer)
```

| Script              | Does                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server                                            |
| `npm run build`     | Generate routes, typecheck, production build          |
| `npm run preview`   | Preview the production build (with COOP/COEP)         |
| `npm run lint`      | ESLint — includes token / arbitrary-value enforcement |
| `npm run typecheck` | Generate routes + `tsc`                               |
| `npm run format`    | Prettier write                                        |

## Theming (the non-negotiable part)

Two-tier design tokens, enforced mechanically:

- **Primitives** (`src/theme/tokens.css`) — raw palette/scales. Never used in
  markup.
- **Semantic tokens** (`src/theme/semantic.css`) — intent-named, remapped to
  primitives under `[data-theme]`. **A theme = one `[data-theme]` block.**
- `src/theme/theme.css` strips Tailwind's default palette via `@theme`, so
  off-token classes (`text-blue-500`, `rounded-3xl`) **don't compile**. ESLint
  bans arbitrary values (`w-[137px]`) and inline `style`.

The `/styleguide` route renders the entire token surface — it's the canvas the
design phase dresses.

## Cross-origin isolation

Multithreaded WASM needs `SharedArrayBuffer`, which requires `COOP: same-origin`
+ `COEP: credentialless`. We use `credentialless` (not `require-corp`) so the
cross-origin Wowhead tooltip script + icon CDN load while the page stays isolated
(see [`docs/OVERALL_PLAN.md`](./docs/OVERALL_PLAN.md) §1/§6). Set in dev via
`vite.config.ts` and in prod via [`public/_headers`](./public/_headers). A runtime
guard (`src/lib/crossOriginIsolated.ts`) surfaces a banner if isolation is
unavailable.

## Deployment (Cloudflare Pages)

CI is in [`.github/workflows`](./.github/workflows): `ci.yml` runs
lint/typecheck/build on every push and PR; `deploy.yml` publishes to Cloudflare
Pages. Before the deploy workflow works you must:

1. Create a Cloudflare Pages project named `wow-freesim` (direct upload / wrangler).
2. Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## License

GPL-3.0-or-later. The whole project is open source (see `docs/OVERALL_PLAN.md`).
