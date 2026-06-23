/**
 * Capture REAL simc json2 output from the published simc-wasm release, under
 * Node.js, so the engine schemas (src/engine/schemas.ts) and any UI fixtures are
 * modeled on reality instead of guessed. This is the "get real reports" step the
 * web plan calls for (WEB_UI_PLAN §5 U2 validation harness), realized locally:
 * the v1205.01 glue carries a full Node path (pthreads via worker_threads), so we
 * can drive it CLI-style without a browser, hosting, or cross-origin/CORS.
 *
 * Usage:
 *   node scripts/capture-report.mjs [profile.simc] [--iterations N] [--out DIR]
 *
 * Requires the engine artifacts in .engine-cache/ (run scripts/fetch-engine.mjs).
 * Writes <out>/<name>.json (raw json2) + <out>/<name>.stdout.txt per run.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, basename } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const ENGINE_DIR = join(repoRoot, '.engine-cache')
const SIMC_JS = join(ENGINE_DIR, 'simc.js')

if (!existsSync(SIMC_JS)) {
  console.error(
    `Engine glue not found at ${SIMC_JS}.\n` +
      `Run: node scripts/fetch-engine.mjs  (downloads the v1205.01 release artifacts)`,
  )
  process.exit(1)
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
let profilePath = null
let iterations = 100
let outDir = join(ENGINE_DIR, 'capture')
const extraArgs = [] // passthrough simc options, e.g. statistics_level=3
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--iterations') iterations = Number(argv[++i])
  else if (a === '--out') outDir = resolve(argv[++i])
  else if (a.includes('=')) extraArgs.push(a) // simc key=value option
  else if (!a.startsWith('--')) profilePath = resolve(a)
}
mkdirSync(outDir, { recursive: true })

// A deliberately small but complete profile: enough to exercise identity, a
// talent loadout, and gear ids in the report without depending on a hand-pasted
// /simc string. DPS magnitude is irrelevant here — we want the json2 SHAPE.
const DEFAULT_PROFILE = `
warrior="CaptureDummy"
level=80
race=orc
region=us
spec=arms
role=attack
`.trim()

const profileText = profilePath
  ? readFileSync(profilePath, 'utf8')
  : DEFAULT_PROFILE
const runName = profilePath ? basename(profilePath).replace(/\.simc$/i, '') : 'default'

console.log(`[capture] engine: ${SIMC_JS}`)
console.log(`[capture] profile: ${profilePath ?? '(built-in default)'}`)
console.log(`[capture] iterations=${iterations}  out=${outDir}`)

// ── boot the module ─────────────────────────────────────────────────────────
const { default: createSimc } = await import('file://' + SIMC_JS.replaceAll('\\', '/'))

const stdout = []
const stderr = []
let onExitCode = null

const Module = await createSimc({
  noInitialRun: true,
  // simc.wasm sits next to simc.js; the glue's default Node loader finds it.
  print: (line) => stdout.push(line),
  printErr: (line) => stderr.push(line),
  onExit: (code) => {
    onExitCode = code
  },
})

console.log('[capture] runtime initialized; writing profile to MEMFS')
Module.FS.writeFile('/profile.simc', profileText)

const args = ['/profile.simc', `iterations=${iterations}`, ...extraArgs, 'json2=/out.json']
console.log(`[capture] callMain(${JSON.stringify(args)})`)

const t0 = Date.now()
let mainReturn
try {
  mainReturn = Module.callMain(args)
} catch (e) {
  if (e && (e.name === 'ExitStatus' || e.message === 'unwind')) {
    // expected under some exit paths
  } else {
    console.error('[capture] callMain threw:', e)
  }
}

// PROXY_TO_PTHREAD may run main off-thread; poll MEMFS for the output to appear
// and stabilize. If main ran synchronously on this thread, out.json is already
// there and the first poll returns immediately.
async function waitForOutput(path, timeoutMs = 180_000) {
  const start = Date.now()
  let lastSize = -1
  let stableCount = 0
  for (;;) {
    const info = Module.FS.analyzePath(path)
    if (info.exists) {
      const size = info.object?.usedBytes ?? info.object?.contents?.length ?? 0
      if (size > 0 && size === lastSize) {
        if (++stableCount >= 2) return true
      } else {
        stableCount = 0
        lastSize = size
      }
    }
    if (onExitCode !== null && info.exists) return true
    if (Date.now() - start > timeoutMs) return info.exists
    await new Promise((r) => setTimeout(r, 100))
  }
}

const got = await waitForOutput('/out.json')
const elapsed = ((Date.now() - t0) / 1000).toFixed(2)
console.log(
  `[capture] main returned=${JSON.stringify(mainReturn)} onExit=${onExitCode} ` +
    `out.json exists=${got} elapsed=${elapsed}s`,
)

writeFileSync(
  join(outDir, `${runName}.stdout.txt`),
  stdout.join('\n') + '\n\n=== STDERR ===\n' + stderr.join('\n'),
)

if (!got) {
  console.error('[capture] out.json was never produced. See stdout/stderr dump:')
  console.error(stderr.slice(-30).join('\n'))
  process.exit(2)
}

const json = Module.FS.readFile('/out.json', { encoding: 'utf8' })
const outFile = join(outDir, `${runName}.json`)
writeFileSync(outFile, json)
console.log(`[capture] wrote ${outFile} (${json.length} bytes)`)

// quick shape probe so the console tells us what we got without opening the file
try {
  const parsed = JSON.parse(json)
  const player = parsed?.sim?.players?.[0]
  console.log('[capture] top-level keys:', Object.keys(parsed).join(', '))
  if (parsed.sim) console.log('[capture] sim keys:', Object.keys(parsed.sim).join(', '))
  if (player) {
    console.log('[capture] player keys:', Object.keys(player).join(', '))
    console.log(
      '[capture] player:',
      player.name,
      player.specialization ?? player.spec,
      'dps=',
      player.collected_data?.dps?.mean,
    )
  }
} catch (e) {
  console.error('[capture] json parse probe failed:', e.message)
}

process.exit(0)
