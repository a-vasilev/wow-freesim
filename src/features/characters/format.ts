/**
 * Display formatting for simc identity tokens (CHARACTER_PERSISTENCE §7). We do
 * NOT invent a class-color token (§7.1) — these are plain title-cased labels in
 * the neutral text tokens. WoW item-quality colors stay game constants elsewhere.
 */

/** "death_knight" → "Death Knight", "arms" → "Arms", "highmountain_tauren" → … */
export function humanizeToken(token: string | undefined | null): string {
  if (!token) return ''
  return token
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Realm shown after a middot, or empty when the paste omitted `server=`. */
export function realmLabel(realm: string | null): string {
  return realm ? humanizeToken(realm) : ''
}
