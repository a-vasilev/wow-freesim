/**
 * Client-side identity parsing (CHARACTER_PERSISTENCE §5.4). Reads the first lines
 * of a `/simc` paste — the `class="Name"` declaration plus `spec=`, `race=`,
 * `server=` / `region=` when present — with NO engine call, so import/match is
 * instant. The match key is `name + realm` (§2.2); realm (`server=`) is often
 * absent in the addon paste (the bundled fixture has neither server nor region),
 * so it degrades to a name-only suggestion downstream.
 */

export interface ParsedIdentity {
  name: string
  /** canonical class key, stable across loadouts (e.g. "death_knight") */
  className: string
  spec?: string
  race?: string
  /** simc `server=`; null when the paste omits it */
  realm: string | null
  /** simc `region=`; null when the paste omits it */
  region: string | null
}

/** simc class option tokens (underscored + un-underscored) → canonical key. */
const CLASS_TOKENS: Record<string, string> = {
  deathknight: 'death_knight',
  demonhunter: 'demon_hunter',
  druid: 'druid',
  evoker: 'evoker',
  hunter: 'hunter',
  mage: 'mage',
  monk: 'monk',
  paladin: 'paladin',
  priest: 'priest',
  rogue: 'rogue',
  shaman: 'shaman',
  warlock: 'warlock',
  warrior: 'warrior',
}

const CLASS_LINE =
  /^\s*(death_?knight|demon_?hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)\s*=\s*"([^"]+)"/im

/** First `key=value` (unquoted) match for a simc scalar option, else undefined. */
function scalar(simc: string, key: string): string | undefined {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]+?)"?\\s*$`, 'im').exec(
    simc,
  )
  return m?.[1]?.trim() || undefined
}

export function parseIdentity(simc: string): ParsedIdentity | null {
  const classMatch = CLASS_LINE.exec(simc)
  if (!classMatch) return null

  const token = classMatch[1].replace(/_/g, '').toLowerCase()
  const className = CLASS_TOKENS[token] ?? token

  return {
    name: classMatch[2].trim(),
    className,
    spec: scalar(simc, 'spec'),
    race: scalar(simc, 'race'),
    realm: scalar(simc, 'server') ?? null,
    region: scalar(simc, 'region') ?? null,
  }
}
