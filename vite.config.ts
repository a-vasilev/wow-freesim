import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const ENGINE_TAG = 'v1205.01-2'
const ENGINE_CACHE = fileURLToPath(new URL('./.engine-cache', import.meta.url))

// Serve the simc-wasm release artifacts SAME-ORIGIN from .engine-cache/ during
// dev/preview, at /engine/<tag>/simc.{js,wasm}. This keeps the 107 MB binary out
// of the Vite graph and out of git while proving the in-browser engine path
// without standing up R2. `simc.js` must be same-origin (pthread workers); the
// wasm is here too in dev (in prod, point VITE_ENGINE_WASM_URL at the R2 domain).
function serveEngineArtifacts(): Plugin {
  const prefix = `/engine/${ENGINE_TAG}/`
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url || !req.url.startsWith(prefix)) return next()
    const name = req.url.slice(prefix.length).split('?')[0]
    if (name !== 'simc.js' && name !== 'simc.wasm') return next()
    const file = join(ENGINE_CACHE, name)
    if (!existsSync(file)) {
      res.statusCode = 404
      res.end(
        `Engine artifact ${name} not found in .engine-cache/. ` +
          `Run: node scripts/fetch-engine.mjs`,
      )
      return
    }
    res.setHeader(
      'Content-Type',
      name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
    )
    res.setHeader('Content-Length', statSync(file).size)
    // The 107 MB wasm is immutable + cacheable; the small glue is no-cache in dev
    // so header/edit changes to it always take effect (its COOP/COEP below are
    // what make the pthread workers isolate).
    res.setHeader(
      'Cache-Control',
      name.endsWith('.wasm')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    )
    // CRITICAL: this middleware pipes its own response, bypassing Vite's global
    // server.headers. simc.js is re-loaded as the pthread worker script, and those
    // nested workers only become cross-origin isolated (→ SharedArrayBuffer → the
    // pthread pool can init) if THIS response also carries COOP/COEP. CORP lets the
    // credentialless page embed the same-origin artifact. Without these, a real
    // sim hangs at 0% while the pool never comes up.
    for (const [h, v] of Object.entries(crossOriginIsolationHeaders)) {
      res.setHeader(h, v)
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    createReadStream(file).pipe(res)
  }
  return {
    name: 'serve-engine-artifacts',
    configureServer(s) {
      s.middlewares.use(middleware)
    },
    configurePreviewServer(s) {
      s.middlewares.use(middleware)
    },
    // Vendor the ~80 KB ES6 glue same-origin into the production build at
    // /engine/<tag>/simc.js. It MUST be same-origin (the engine re-loads it as the
    // em-pthread worker script — WEB_UI_PLAN §3.1), and it's well under the Pages
    // 25 MiB limit. The 107 MB simc.wasm is deliberately NOT emitted here — it's
    // served cross-origin from R2 (set VITE_ENGINE_WASM_URL). See docs/DEPLOY.md.
    writeBundle(options) {
      const outDir =
        options.dir ?? fileURLToPath(new URL('./dist', import.meta.url))
      const src = join(ENGINE_CACHE, 'simc.js')
      if (!existsSync(src)) {
        this.warn(
          `engine glue not found at ${src} — run "node scripts/fetch-engine.mjs" ` +
            `before building, or prod will 404 on /engine/${ENGINE_TAG}/simc.js`,
        )
        return
      }
      const destDir = join(outDir, 'engine', ENGINE_TAG)
      mkdirSync(destDir, { recursive: true })
      copyFileSync(src, join(destDir, 'simc.js'))
    },
  }
}

// Cross-origin isolation is mandatory for multithreaded WASM: SharedArrayBuffer
// requires these headers. COEP is `credentialless` (NOT `require-corp`) on purpose:
// it keeps the page isolated while letting the cross-origin Wowhead tooltip script
// + icon CDN load without CORP headers — the mechanism behind our zero-bundle
// item/spell display. See docs/OVERALL_PLAN.md §1/§6 and public/_headers (prod).
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    serveEngineArtifacts(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
})
