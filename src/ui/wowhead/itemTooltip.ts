/**
 * Single network+cache layer over Wowhead's CORS-enabled tooltip JSON endpoint
 * (`nether.wowhead.com/tooltip/item/{id}`). This is the ONE place an item id turns
 * into a network request — every other module derives what it needs from the cached
 * payload, so an id is fetched at most once no matter how many consumers want it:
 *   - display (icon/name/quality) → src/ui/item/itemDisplay.ts reads name/quality/icon
 *   - equippability filtering      → src/features/gear/wowheadItem.ts parses .tooltip
 *
 * In-flight requests are deduped by id, so concurrent callers (Top Gear validates
 * bag items for filtering while ItemCells mount for display) share one fetch.
 * Fails OPEN: any failure caches `null` and callers fall back (visible fallback
 * name / item treated as usable).
 */
const BASE = 'https://nether.wowhead.com/tooltip/item/'

export interface WowheadTooltip {
  /** Display name. */
  name?: string
  /** Quality tier 0..5. */
  quality?: number
  /** Icon name (no extension); build a URL as `…/icons/large/{icon}.jpg`. */
  icon?: string
  /** Raw tooltip HTML (carries the numeric class/subclass + restriction markers). */
  tooltip?: string
}

const cache = new Map<string, WowheadTooltip | null>()
const inflight = new Map<string, Promise<WowheadTooltip | null>>()

/**
 * Cache/URL key for an item. Bonus ids matter because they drive the item level
 * (and stats) the tooltip reports — the same id at different upgrade tracks is a
 * different payload. Class/subclass/name/icon don't change with bonus, so callers
 * that only need those still share the fetch by passing the same bonus ids.
 */
function keyFor(id: number, bonusIds: readonly number[]): string {
  return bonusIds.length ? `${id}?bonus=${bonusIds.join(':')}` : `${id}`
}

/** Cached payload, or `undefined` if this id+bonus has never been fetched. */
export function getCachedTooltip(
  id: number,
  bonusIds: readonly number[] = [],
): WowheadTooltip | null | undefined {
  return cache.get(keyFor(id, bonusIds))
}

/** Fetch one item's tooltip JSON (cached + in-flight-deduped; `null` on any failure). */
export function fetchTooltip(
  id: number,
  bonusIds: readonly number[] = [],
): Promise<WowheadTooltip | null> {
  const key = keyFor(id, bonusIds)
  const cached = cache.get(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async () => {
    let data: WowheadTooltip | null = null
    try {
      const res = await fetch(`${BASE}${key}`, { mode: 'cors' })
      if (res.ok) data = (await res.json()) as WowheadTooltip
    } catch {
      data = null
    }
    cache.set(key, data)
    inflight.delete(key)
    return data
  })()
  inflight.set(key, promise)
  return promise
}
