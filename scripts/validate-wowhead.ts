/**
 * Validate Wowhead-based item validation against the REAL tooltip API: fetch a few
 * items, parse class/subclass/class-restriction, and check the usability rules for
 * a Mage (cloth) vs a Warrior (plate).
 *
 *   npx tsx scripts/validate-wowhead.ts
 */
import { fetchItemClassInfo } from '../src/features/gear/wowheadItem.ts'
import { isUsable, type ItemClassInfo } from '../src/features/gear/itemRules.ts'

const MAGE = 8
const WARRIOR = 1

interface Case {
  id: number
  slot: string
  label: string
  expectMage: boolean
  expectWarrior: boolean
}
const cases: Case[] = [
  // Warrior tier head (Plate, class-locked to Warrior).
  {
    id: 249952,
    slot: 'head',
    label: 'plate head (warrior-locked)',
    expectMage: false,
    expectWarrior: true,
  },
  // Generic plate wrists (Plate, no class lock).
  {
    id: 237834,
    slot: 'wrists',
    label: 'plate wrists (generic)',
    expectMage: false,
    expectWarrior: true,
  },
  // A ring (Misc armor → no proficiency rule, usable by all).
  {
    id: 249920,
    slot: 'finger1',
    label: 'ring',
    expectMage: true,
    expectWarrior: true,
  },
]

let failed = 0
for (const c of cases) {
  const info = await fetchItemClassInfo(c.id)
  const mage = isUsable(MAGE, c.slot, info)
  const warrior = isUsable(WARRIOR, c.slot, info)
  const ok = mage === c.expectMage && warrior === c.expectWarrior
  if (!ok) failed++
  console.log(
    `${ok ? '✓' : '✗'} ${c.label} (id ${c.id}): class=${info?.classId} subclass=${info?.subclassId} ` +
      `classes=[${info?.allowedClasses.join(',')}] → mage=${mage} (want ${c.expectMage}), ` +
      `warrior=${warrior} (want ${c.expectWarrior})`,
  )
}

// Synthetic rank-rule checks (no network): armor proficiency is cumulative.
const armor = (sub: number): ItemClassInfo => ({
  classId: 4,
  subclassId: sub,
  allowedClasses: [],
})
const rank: [string, number, number, boolean][] = [
  // [label, classId, armorSubclass, expectedUsable]
  ['mage + cloth', MAGE, 1, true],
  ['mage + leather', MAGE, 2, false],
  ['mage + plate', MAGE, 4, false],
  ['warrior + cloth', WARRIOR, 1, true], // plate class wears everything lighter
  ['warrior + plate', WARRIOR, 4, true],
  ['hunter + mail', 3, 3, true],
  ['hunter + plate', 3, 4, false],
]
for (const [label, cls, sub, want] of rank) {
  const got = isUsable(cls, 'chest', armor(sub))
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${label}: usable=${got} (want ${want})`)
}

console.log(failed ? `\n✗ ${failed} check(s) failed` : '\n✓ all checks passed')
process.exit(failed ? 1 : 0)
