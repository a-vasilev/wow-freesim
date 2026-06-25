import { useEffect, useSyncExternalStore } from 'react'
import { fetchTooltip } from '@/ui/wowhead/itemTooltip'

/**
 * Per-item display cache: icon URL, real display name, quality tier, and item
 * level. ItemCell renders from this React-owned state, so re-mounts (back button,
 * route changes) are instant and correct.
 *
 * Derived from the shared Wowhead tooltip payload (`@/ui/wowhead/itemTooltip` —
 * one fetch per item-spec, shared with the equippability filter), NOT by scraping
 * the DOM the Power script injects. Scraping was fragile: `refreshLinks()`
 * short-circuits when Power has the entity cached internally, leaving no mutation
 * for a MutationObserver to catch, so freshly mounted cells (e.g. bag candidates
 * in Top Gear) got stuck on the fallback questionmark + humanized name. The JSON
 * payload is deterministic for every item, mount, and re-mount. (Power.js is still
 * loaded for the live hover tooltip.)
 *
 * Keyed by id+bonus: bonus ids drive the upgraded item level the tooltip reports,
 * so the same id at a different upgrade track is a distinct entry.
 */
export interface ItemDisplay {
  /** zamimg icon URL; absent until fetched (cell shows the questionmark). */
  iconUrl?: string
  /** Real display name (Wowhead) or the humanized token fallback. */
  name: string
  /** Wowhead quality tier 0..5, or null if not yet known. */
  qualityTier: number | null
  /** Item level (bonus-adjusted), or undefined if not yet known / unparseable. */
  ilvl?: number
}

/** What we need to key + fetch an item's display (a structural slice of GearItem). */
interface ItemRef {
  itemId: number
  bonusIds: number[]
}

const cache = new Map<string, ItemDisplay>()
const listeners = new Map<string, Set<() => void>>()
/** Keys whose derive has been kicked off — never re-run (the fetch itself is also cached). */
const attempted = new Set<string>()

const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/large/'
// Locale-independent item-level marker in the tooltip HTML (`Item Level <!--ilvl-->NNN`).
const ILVL_RE = /<!--ilvl-->(\d+)/

function keyOf(item: ItemRef): string {
  return item.bonusIds.length
    ? `${item.itemId}?bonus=${item.bonusIds.join(':')}`
    : `${item.itemId}`
}

function setItemDisplay(key: string, next: ItemDisplay): void {
  const prev = cache.get(key)
  if (
    prev &&
    prev.iconUrl === next.iconUrl &&
    prev.name === next.name &&
    prev.qualityTier === next.qualityTier &&
    prev.ilvl === next.ilvl
  ) {
    return
  }
  cache.set(key, next)
  listeners.get(key)?.forEach((l) => l())
}

function subscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(cb)
  return () => {
    set.delete(cb)
    if (set.size === 0) listeners.delete(key)
  }
}

/**
 * Derive {iconUrl, name, qualityTier, ilvl} for an item from the shared tooltip
 * payload into the cache, once. No-ops if already kicked off. On any failure we
 * leave the cache empty so the cell keeps its humanized fallback name.
 */
export function fetchItemDisplay(item: ItemRef): void {
  const key = keyOf(item)
  if (attempted.has(key)) return
  attempted.add(key)
  void fetchTooltip(item.itemId, item.bonusIds).then((data) => {
    if (!data || (!data.name && !data.icon)) return
    const ilvl = ILVL_RE.exec(data.tooltip ?? '')
    setItemDisplay(key, {
      name: data.name || cache.get(key)?.name || '',
      qualityTier: data.quality ?? null,
      iconUrl: data.icon ? `${ICON_BASE}${data.icon}.jpg` : undefined,
      ilvl: ilvl ? Number(ilvl[1]) : undefined,
    })
  })
}

/** Subscribe a component to one item's cached display, fetching it on first use. */
export function useItemDisplay(item: ItemRef): ItemDisplay | undefined {
  const key = keyOf(item)
  useEffect(() => {
    fetchItemDisplay(item)
    // key captures the only inputs that matter (id + bonus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => cache.get(key),
  )
}
