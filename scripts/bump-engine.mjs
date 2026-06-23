/**
 * Bump the pinned simc-wasm engine version (Strategy A: CI bump + auto-deploy).
 *
 * What it does for a given release tag:
 *   1. Fetch the release `manifest.json` (the tag + sha256 record).
 *   2. Fetch + verify the ~80 KB `simc.js` glue and VENDOR it same-origin at
 *      `public/engine/<tag>/simc.js` (pthread worker scripts must be same-origin,
 *      so the glue ships as a normal Pages static asset). Older `public/engine/v*`
 *      dirs are pruned — config pins exactly one tag.
 *   3. Rewrite the pin in `src/engine/config.ts` (tag, scVersion, sha256.{glue,wasm}).
 *
 * It deliberately does NOT touch the 107 MB `simc.wasm`: that lives in R2, uploaded
 * by the engine-bump workflow (see .github/workflows/engine-bump.yml). This script
 * only updates what the app bundle/serving needs + the integrity record the runtime
 * verifies the R2 bytes against.
 *
 *   node scripts/bump-engine.mjs <tag>     # e.g. node scripts/bump-engine.mjs v1206.02
 *
 * After running: review the diff, commit, and the Pages Git integration redeploys.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')
const PUBLIC_ENGINE = join(ROOT, 'public', 'engine')
const CONFIG_PATH = join(ROOT, 'src', 'engine', 'config.ts')

const tag = process.argv[2]
if (!tag || !/^v\d+\.\d+$/.test(tag)) {
  console.error('usage: node scripts/bump-engine.mjs <tag>   (e.g. v1206.02)')
  process.exit(1)
}

const BASE = `https://github.com/a-vasilev/simc-wasm/releases/download/${tag}`
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const strip = (s) => String(s).replace(/^sha256:/, '')

async function fetchBuf(name) {
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${name} for ${tag}`)
  return Buffer.from(await res.arrayBuffer())
}

console.log(`[bump] engine -> ${tag}`)
// The release manifest can carry stray control chars inside string values
// (v1205.01's `sc_version` has an embedded CR). Strip ASCII control chars before
// parsing — JSON treats inter-token whitespace as optional, so this only cleans
// the malformed string contents (e.g. "1205\r-01" -> "1205-01").
const manifestText = (await fetchBuf('manifest.json')).toString('utf8').replace(/[\x00-\x1f]/g, '')
const manifest = JSON.parse(manifestText)
const want = {
  glue: strip(manifest.files['simc.js']),
  wasm: strip(manifest.files['simc.wasm']),
}
// Derive the display version from the tag (vNNNN.NN -> NNNN-NN). The manifest's
// own `sc_version` is unreliable (v1205.01 ships it as "1205\r--01"), so we don't
// trust it.
const scVersion = tag.replace(/^v/, '').replace(/\./g, '-')

// 1+2. Vendor + verify the glue, prune older tags.
const glue = await fetchBuf('simc.js')
const gotGlue = sha256(glue)
if (gotGlue !== want.glue) {
  console.error(`[bump] simc.js integrity MISMATCH\n  got  ${gotGlue}\n  want ${want.glue}`)
  process.exit(1)
}
if (existsSync(PUBLIC_ENGINE)) {
  for (const d of readdirSync(PUBLIC_ENGINE)) {
    if (/^v\d+\.\d+$/.test(d) && d !== tag) {
      rmSync(join(PUBLIC_ENGINE, d), { recursive: true, force: true })
      console.log(`[bump] pruned stale public/engine/${d}`)
    }
  }
}
const dest = join(PUBLIC_ENGINE, tag)
mkdirSync(dest, { recursive: true })
writeFileSync(join(dest, 'simc.js'), glue)
console.log(`[bump] vendored public/engine/${tag}/simc.js (${(glue.length / 1024).toFixed(1)} KB, sha256 OK)`)

// 3. Rewrite the pin in config.ts.
let cfg = readFileSync(CONFIG_PATH, 'utf8')
const edits = [
  [/const TAG = '[^']*'/, `const TAG = '${tag}'`],
  [/scVersion: '[^']*'/, `scVersion: '${scVersion}'`],
  [/glue: '[0-9a-f]{64}'/, `glue: '${want.glue}'`],
  [/wasm: '[0-9a-f]{64}'/, `wasm: '${want.wasm}'`],
]
for (const [re, replacement] of edits) {
  if (!re.test(cfg)) {
    console.error(`[bump] could not find /${re.source}/ in config.ts — aborting (no partial write)`)
    process.exit(1)
  }
  cfg = cfg.replace(re, replacement)
}
writeFileSync(CONFIG_PATH, cfg)
console.log(`[bump] updated src/engine/config.ts (tag=${tag}, scVersion=${scVersion})`)

console.log(
  `\n[bump] done. Next:\n` +
    `  • Upload the wasm to R2 at  <tag>/simc.wasm  (workflow does this; sha256 ${want.wasm.slice(0, 12)}…)\n` +
    `  • Review the diff, commit, and let Cloudflare Pages redeploy.`,
)
