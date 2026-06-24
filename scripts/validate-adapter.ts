/**
 * Dev check: run the real captured json2 through the adapter + Zod schemas to
 * confirm they accept real simc output. Run:
 *   node --experimental-strip-types scripts/validate-adapter.ts <capture.json>
 */
import { readFileSync } from 'node:fs'
import {
  parseCharacter,
  parseProfilesetReport,
  parseSimReport,
} from '../src/engine/json2.ts'

const file = process.argv[2] ?? '.engine-cache/capture/MID1_Warrior_Arms.json'
const raw = JSON.parse(readFileSync(file, 'utf8'))

// Profileset captures carry sim.profilesets — validate that path and stop.
if (raw?.sim?.profilesets) {
  const pr = parseProfilesetReport(raw)
  console.log('✓ parseProfilesetReport OK')
  console.log('  metric:', pr.metric, '· iters', pr.meta.iterations)
  console.log(
    '  baseline:',
    pr.baseline.name,
    Math.round(pr.baseline.dps.mean),
    `± ${Math.round(pr.baseline.meanError ?? 0)}`,
  )
  console.log('  sets:', pr.sets.length)
  for (const s of [...pr.sets].sort((a, b) => b.dps.mean - a.dps.mean)) {
    const delta = s.dps.mean - pr.baseline.dps.mean
    const pct = (delta / pr.baseline.dps.mean) * 100
    console.log(
      `    ${s.name.padEnd(18)} ${Math.round(s.dps.mean).toString().padStart(8)}  ` +
        `${delta >= 0 ? '+' : ''}${Math.round(delta)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%) ± ${Math.round(s.meanError ?? 0)}`,
    )
  }
  process.exit(0)
}

const character = parseCharacter(raw)
const report = parseSimReport(raw)

console.log('✓ parseCharacter OK')
console.log('  identity:', character.name, '·', character.specialization, '· lvl', character.level, '· ilvl', character.ilvl)
console.log('  gear pieces:', character.gear.length)
console.log('  first item:', JSON.stringify(character.gear[0]))
console.log('  talents loadout:', character.talents.loadout.slice(0, 40) + '…')

console.log('\n✓ parseSimReport OK')
console.log('  simc:', report.meta.simcVersion, '· iters', report.meta.iterations, '· fight', report.meta.fightStyle)
console.log('  DPS:', Math.round(report.dps.mean), '±', Math.round(report.dps.meanStdDev ?? 0), `(min ${Math.round(report.dps.min ?? 0)} / max ${Math.round(report.dps.max ?? 0)})`)
console.log('  abilities:', report.abilities.length, '— top:', report.abilities.slice(0, 4).map((a) => `${a.name} ${Math.round(a.dps)} (${a.damagePct.toFixed(1)}%)`).join(', '))
console.log('  buffs:', report.buffs.length, '· debuffs:', report.debuffs.length)
console.log('  damage timeline buckets:', report.damageTimeline?.length ?? 0)
