/**
 * Download the pinned simc-wasm release artifacts into .engine-cache/ and verify
 * their sha256 against the release manifest. The 107 MB wasm must never be
 * committed or bundled — it lives only in this gitignored cache (served
 * same-origin in dev by the Vite middleware; from R2 in prod).
 *
 *   node scripts/fetch-engine.mjs [tag]   # default tag: v1205.01
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ENGINE_DIR = resolve(here, '..', '.engine-cache')
const TAG = process.argv[2] ?? 'v1205.01'
const BASE = `https://github.com/a-vasilev/simc-wasm/releases/download/${TAG}`

mkdirSync(ENGINE_DIR, { recursive: true })

async function fetchTo(name) {
  const dest = join(ENGINE_DIR, name)
  process.stdout.write(`[fetch] ${name} … `)
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${name}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`)
  return buf
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

console.log(`[fetch] simc-wasm ${TAG} -> ${ENGINE_DIR}`)
const manifestBuf = await fetchTo('manifest.json')
// The release manifest can carry stray control chars inside string values (the
// `sc_version` ships with an embedded CR — same quirk handled in bump-engine.mjs).
// Strip ASCII control chars before parsing; JSON treats inter-token whitespace as
// optional, so this only cleans the malformed string contents.
const manifest = JSON.parse(manifestBuf.toString('utf8').replace(/[\x00-\x1f]/g, ''))
const expect = Object.fromEntries(
  Object.entries(manifest.files).map(([k, v]) => [k, String(v).replace(/^sha256:/, '')]),
)

let ok = true
for (const name of ['simc.js', 'simc.wasm']) {
  const buf = existsSync(join(ENGINE_DIR, name))
    ? readFileSync(join(ENGINE_DIR, name))
    : await fetchTo(name)
  const got = sha256(buf)
  const want = expect[name]
  const match = got === want
  ok &&= match
  console.log(`[verify] ${name}: ${match ? 'OK' : `MISMATCH\n  got  ${got}\n  want ${want}`}`)
}

if (!ok) {
  console.error('[fetch] integrity check FAILED')
  process.exit(1)
}
console.log('[fetch] done — artifacts verified.')
