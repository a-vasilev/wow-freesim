/**
 * End-to-end Top Gear validation under Node: exercises the REAL pipeline modules
 * (parseGearModel → generateCombos → planProfilesets) + the engine, proving the
 * profileset `.simc` we build actually sims and parses. Uses a guaranteed-valid
 * "bag" variant (the equipped head minus its gem/enchant) so there's a real combo
 * and a real, slightly-lower DPS delta — no item catalog needed.
 *
 *   npx tsx scripts/validate-topgear.ts
 */
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { parseGearModel } from '../src/features/gear/gearModel.ts'
import { generateCombos } from '../src/features/gear/combos.ts'
import { planProfilesets } from '../src/features/gear/profilesets.ts'
import { parseProfilesetReport } from '../src/engine/json2.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const SIMC_JS = join(repoRoot, '.engine-cache', 'simc.js')
if (!existsSync(SIMC_JS)) {
  console.error(
    `Engine glue not found at ${SIMC_JS}. Run scripts/fetch-engine.mjs`,
  )
  process.exit(1)
}

// Base profile + a bag head identical to the equipped one minus gem/enchant.
const base = readFileSync(
  join(repoRoot, 'src/engine/fixtures/sample-profile.simc'),
  'utf8',
)
const profile = `${base}\n\n### Gear from Bags\n# head=night_enders_tusks,id=249952,bonus_id=12806/13335\n`

// 1. Parse the gear model from raw text.
const model = parseGearModel(profile)
const head = model.slots.find((s) => s.key === 'head')
console.log('✓ parseGearModel:', model.slots.length, 'equipped slots')
console.log(
  '  head candidates:',
  head?.candidates.length,
  '(sources:',
  head?.candidates.map((c) => c.source).join('/') + ')',
)
if (!head || head.candidates.length !== 2) {
  console.error('✗ expected 2 head candidates (equipped + bag)')
  process.exit(1)
}

// 2. Select BOTH head candidates; everything else stays equipped.
const selection: Record<string, string[]> = {}
for (const s of model.slots)
  selection[s.key] = s.equippedUid ? [s.equippedUid] : []
selection['head'] = head.candidates.map((c) => c.uid)

// 3. Combos → plans.
const combos = generateCombos(model, selection)
const plans = planProfilesets(model, combos)
console.log('✓ combos:', combos.length, '→ plans:', plans.length)
console.log('  plan overrides:', JSON.stringify(plans.map((p) => p.overrides)))
if (plans.length !== 1) {
  console.error('✗ expected exactly 1 plan (bag-head swap)')
  process.exit(1)
}

// 4. Build the profileset .simc exactly as the worker does, run, parse.
const psText =
  profile.trimEnd() +
  '\n\n' +
  plans
    .flatMap((p) => p.overrides.map((ov) => `profileset."${p.name}"+="${ov}"`))
    .join('\n') +
  '\n'

const { default: createSimc } = await import(
  'file://' + SIMC_JS.replaceAll('\\', '/')
)
const stderr: string[] = []
const Module = await createSimc({
  noInitialRun: true,
  print: () => {},
  printErr: (l: string) => stderr.push(l),
})
Module.FS.writeFile('/p.simc', psText)
try {
  Module.callMain(['/p.simc', 'iterations=100', 'json2=/out.json'])
} catch (e) {
  const err = e as { name?: string; message?: string }
  if (err.name !== 'ExitStatus' && err.message !== 'unwind') throw e
}
if (!Module.FS.analyzePath('/out.json').exists) {
  console.error('✗ no out.json\n' + stderr.slice(-15).join('\n'))
  process.exit(1)
}
const raw = JSON.parse(Module.FS.readFile('/out.json', { encoding: 'utf8' }))

// 5. Parse + report.
const report = parseProfilesetReport(raw)
const set = report.sets[0]
const delta = set.dps.mean - report.baseline.dps.mean
console.log('✓ parseProfilesetReport OK')
console.log(
  '  baseline:',
  Math.round(report.baseline.dps.mean).toLocaleString(),
  '· set (head w/o gem+ench):',
  Math.round(set.dps.mean).toLocaleString(),
  `· Δ ${Math.round(delta)} (${((delta / report.baseline.dps.mean) * 100).toFixed(2)}%)`,
)
console.log(
  delta < 0
    ? '✓ delta is negative as expected (lost a gem + enchant)'
    : '⚠ delta non-negative — unexpected but pipeline ran',
)
process.exit(0)
