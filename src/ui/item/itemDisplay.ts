import { useEffect, useSyncExternalStore } from 'react'

/**
 * Per-item display cache: the icon URL, real display name, and quality tier for
 * an item id. ItemCell renders from this React-owned state, so re-mounts (back
 * button, route changes) are instant and correct.
 *
 * We get the three fields from Wowhead's CORS-enabled tooltip JSON endpoint
 * (`nether.wowhead.com/tooltip/item/{id}` — the SAME endpoint wowheadItem.ts uses
 * for armor-type), NOT by scraping the DOM the Power script injects. Scraping was
 * fragile: `refreshLinks()` short-circuits when Power has the entity cached
 * internally, leaving no mutation for a MutationObserver to catch, so freshly
 * mounted cells (e.g. bag candidates in Top Gear) got stuck on the fallback
 * questionmark + humanized name. The JSON fetch is deterministic for every item,
 * mount, and re-mount. (Power.js is still loaded for the live hover tooltip.)
 */
export interface ItemDisplay {
  /** zamimg icon URL; absent until fetched (cell shows the questionmark). */
  iconUrl?: string
  /** Real display name (Wowhead) or the humanized token fallback. */
  name: string
  /** Wowhead quality tier 0..5, or null if not yet known. */
  qualityTier: number | null
}

const cache = new Map<number, ItemDisplay>()
const listeners = new Map<number, Set<() => void>>()
/** Ids whose fetch is in flight or has completed (success or failure) — never refetched. */
const attempted = new Set<number>()

const TOOLTIP_BASE = 'https://nether.wowhead.com/tooltip/item/'
const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/large/'

export function getItemDisplay(itemId: number): ItemDisplay | undefined {
  return cache.get(itemId)
}

function setItemDisplay(itemId: number, next: ItemDisplay): void {
  const prev = cache.get(itemId)
  if (
    prev &&
    prev.iconUrl === next.iconUrl &&
    prev.name === next.name &&
    prev.qualityTier === next.qualityTier
  ) {
    return
  }
  cache.set(itemId, next)
  listeners.get(itemId)?.forEach((l) => l())
}

function subscribe(itemId: number, cb: () => void): () => void {
  let set = listeners.get(itemId)
  if (!set) listeners.set(itemId, (set = new Set()))
  set.add(cb)
  return () => {
    set.delete(cb)
    if (set.size === 0) listeners.delete(itemId)
  }
}

interface TooltipJson {
  name?: string
  quality?: number
  icon?: string
}

/**
 * Fetch {iconUrl, name, qualityTier} for `itemId` from Wowhead's tooltip JSON,
 * once, into the cache. No-ops if already attempted (in flight or done). On any
 * failure we leave the cache empty so the cell keeps its humanized fallback name.
 */
export function fetchItemDisplay(itemId: number): void {
  if (attempted.has(itemId)) return
  attempted.add(itemId)
  void (async () => {
    try {
      const res = await fetch(`${TOOLTIP_BASE}${itemId}`, { mode: 'cors' })
      if (!res.ok) return
      const data = (await res.json()) as TooltipJson
      if (!data.name && !data.icon) return
      setItemDisplay(itemId, {
        name: data.name || cache.get(itemId)?.name || '',
        qualityTier: data.quality ?? null,
        iconUrl: data.icon ? `${ICON_BASE}${data.icon}.jpg` : undefined,
      })
    } catch {
      // Network/parse failure — fail open; the cell shows its fallback name.
    }
  })()
}

/** Subscribe a component to one item's cached display, fetching it on first use. */
export function useItemDisplay(itemId: number): ItemDisplay | undefined {
  useEffect(() => {
    fetchItemDisplay(itemId)
  }, [itemId])
  return useSyncExternalStore(
    (cb) => subscribe(itemId, cb),
    () => cache.get(itemId),
  )
}
