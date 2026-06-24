/**
 * Per-item class/subclass + class-restriction lookup from Wowhead's tooltip API —
 * `nether.wowhead.com/tooltip/item/{id}`, the SAME CORS-enabled endpoint
 * `tooltips.js` uses (the `www.wowhead.com/item=…&xml` view has no CORS header, so
 * the browser can't read it; see WEB_UI_PLAN §7). The tooltip HTML embeds the data
 * we need as NUMERIC, locale-independent markers:
 *   <!--scstart{classId}:{subclassId}-->  → item class + subclass (= armor type)
 *   <... item-classes ...>…/class={id}/…  → explicit class restriction list
 * We parse those ids (not display words) and feed itemRules.ts. Results cache by id;
 * any failure → null, and callers fail OPEN (never hide an item we couldn't read).
 */
export interface ItemClassInfo {
  /** Wowhead item class id (2 = Weapon, 4 = Armor). */
  classId?: number
  /** Subclass id — for Armor: 1 Cloth / 2 Leather / 3 Mail / 4 Plate / 6 Shield. */
  subclassId?: number
  /** Class ids the item is restricted to (empty = no restriction). */
  allowedClasses: number[]
}

const TOOLTIP_BASE = 'https://nether.wowhead.com/tooltip/item/'
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

/** Fetch + parse one item's class info (cached; null on any failure). */
export async function fetchItemClassInfo(
  id: number,
): Promise<ItemClassInfo | null> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  let info: ItemClassInfo | null = null
  try {
    const res = await fetch(`${TOOLTIP_BASE}${id}`, { mode: 'cors' })
    if (res.ok) {
      const data = (await res.json()) as { tooltip?: string }
      info = parseTooltip(data.tooltip ?? '')
    }
  } catch {
    info = null
  }
  cache.set(id, info)
  return info
}

/** Look up many item ids in parallel; returns a Map id → info|null. */
export async function fetchItemClassInfos(
  ids: number[],
): Promise<Map<number, ItemClassInfo | null>> {
  const unique = [...new Set(ids)]
  const infos = await Promise.all(unique.map((id) => fetchItemClassInfo(id)))
  return new Map(unique.map((id, i) => [id, infos[i]]))
}
