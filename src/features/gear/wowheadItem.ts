/**
 * Per-item class/subclass + class-restriction lookup, parsed from the tooltip HTML
 * in the shared Wowhead payload (`@/ui/wowhead/itemTooltip` — one fetch per id,
 * shared with the display layer). The HTML embeds the data we need as NUMERIC,
 * locale-independent markers:
 *   <!--scstart{classId}:{subclassId}-->  → item class + subclass (= armor type)
 *   <... item-classes ...>…/class={id}/…  → explicit class restriction list
 * We parse those ids (not display words) and feed itemRules.ts. Results cache by id;
 * any failure → null, and callers fail OPEN (never hide an item we couldn't read).
 */
import { fetchTooltip } from '@/ui/wowhead/itemTooltip'

export interface ItemClassInfo {
  /** Wowhead item class id (2 = Weapon, 4 = Armor). */
  classId?: number
  /** Subclass id — for Armor: 1 Cloth / 2 Leather / 3 Mail / 4 Plate / 6 Shield. */
  subclassId?: number
  /** Class ids the item is restricted to (empty = no restriction). */
  allowedClasses: number[]
}

const cache = new Map<number, ItemClassInfo | null>()

/** Parse the numeric class/subclass + class-restriction markers from tooltip HTML. */
export function parseTooltip(html: string): ItemClassInfo {
  const info: ItemClassInfo = { allowedClasses: [] }

  const sc = /scstart(\d+):(\d+)/.exec(html)
  if (sc) {
    info.classId = Number(sc[1])
    info.subclassId = Number(sc[2])
  }

  // The class restriction (tier sets, class-locked items) is a dedicated block;
  // scope the `class=<id>` scan to it so we don't catch unrelated links.
  const block = /wowhead-tooltip-item-classes[\s\S]*?<\/div>/.exec(html)
  if (block) {
    const re = /class=(\d+)\//g
    let m: RegExpExecArray | null
    while ((m = re.exec(block[0])) !== null) {
      info.allowedClasses.push(Number(m[1]))
    }
  }

  return info
}

/**
 * Fetch + parse one item's class info (cached by id; null on any failure). Class /
 * subclass / restriction don't vary with bonus, so the result caches by id — but we
 * forward the item's `bonusIds` so the underlying tooltip fetch shares its cache
 * key with the display layer (one network request per item-spec).
 */
export async function fetchItemClassInfo(
  id: number,
  bonusIds: readonly number[] = [],
): Promise<ItemClassInfo | null> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const data = await fetchTooltip(id, bonusIds)
  const info = data ? parseTooltip(data.tooltip ?? '') : null
  cache.set(id, info)
  return info
}

/** What we need to look up an item's class info (a structural slice of GearItem). */
export interface ClassInfoQuery {
  itemId: number
  bonusIds: number[]
}

/** Look up many items in parallel; returns a Map itemId → info|null. */
export async function fetchItemClassInfos(
  items: ClassInfoQuery[],
): Promise<Map<number, ItemClassInfo | null>> {
  const byId = new Map<number, ClassInfoQuery>()
  for (const it of items) if (!byId.has(it.itemId)) byId.set(it.itemId, it)
  const unique = [...byId.values()]
  const infos = await Promise.all(
    unique.map((it) => fetchItemClassInfo(it.itemId, it.bonusIds)),
  )
  return new Map(unique.map((it, i) => [it.itemId, infos[i]]))
}
