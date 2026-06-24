/**
 * Wowhead "Power" tooltip + icon layer (OVERALL_PLAN §6, WEB_UI_PLAN U3). Loads
 * `wow.zamimg.com/js/tooltips.js` ONCE and lets it render item/spell/enchant/gem
 * icons + full game tooltips from ids — our entire display layer, no data bundle.
 * Works on the cross-origin-isolated page only because COEP is `credentialless`
 * (the no-cors script/img are exempt from CORP there).
 *
 * Item params map 1:1 from a simc item string: id → `item=`, bonus_id → `bonus=`,
 * gem_id → `gems=`, enchant_id → `ench=`, ilevel → `ilvl=` (see buildItemHref).
 */
import { useEffect } from 'react'
import type { GearItem } from '@/engine'

interface WowheadGlobal {
  refreshLinks?: (force?: boolean) => void
}
declare global {
  interface Window {
    whTooltips?: Record<string, boolean>
    WH?: WowheadGlobal
  }
}

// The official Power script (https://www.wowhead.com/tooltips). Exposes `window.WH`
// with `refreshLinks()`, reads config from `window.whTooltips`. (The previous
// `js/tooltips.js` was the legacy widget.)
const SCRIPT_SRC = 'https://wow.zamimg.com/widgets/power.js'
let loadPromise: Promise<void> | null = null

/** Inject the Power script once (idempotent). Resolves when it has loaded. */
export function loadWowhead(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return resolve()
    // Config must exist before the script runs. We enable all three globally so
    // plain WowheadItem/WowheadSpell links elsewhere (ability breakdown, talents)
    // icon+color+rename as before; ItemCell opts individual links out per-link via
    // data-wh-rename-link / data-wh-iconize-link.
    window.whTooltips = {
      colorLinks: true,
      iconizeLinks: true,
      renameLinks: true,
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    )
    if (existing) return resolve()
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    // Load as a plain NO-CORS subresource — allowed under COEP: credentialless,
    // which is exactly why we use credentialless not require-corp. Do NOT set
    // crossOrigin: that forces a CORS request, and Wowhead sends no ACAO → blocked.
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Wowhead power.js'))
    document.head.appendChild(script)
  })
  return loadPromise
}

let refreshScheduled = false

/**
 * Re-scan the DOM after React adds/changes Wowhead links. Debounced to one
 * `refreshLinks()` per frame so a screen full of ItemCells coalesces into a
 * single pass (refreshLinks walks every `document.links` entry — O(n) each call).
 */
export function refreshWowhead(): void {
  if (refreshScheduled) return
  refreshScheduled = true
  const run = () => {
    refreshScheduled = false
    window.WH?.refreshLinks?.()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  else setTimeout(run, 0)
}

/** Ensure the Power script is loaded, then re-scan whenever `deps` change. */
export function useWowhead(deps: readonly unknown[] = []): void {
  useEffect(() => {
    let cancelled = false
    loadWowhead().then(() => {
      if (!cancelled) refreshWowhead()
    })
    return () => {
      cancelled = true
    }
    // refresh is cheap + idempotent; re-run when caller's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Build a wowhead.com href + the `data-wowhead` param string for a gear item. */
export function buildItemWowhead(item: GearItem): {
  href: string
  data: string
} {
  const params: string[] = [`item=${item.itemId}`]
  if (item.ilvl) params.push(`ilvl=${item.ilvl}`)
  if (item.bonusIds.length) params.push(`bonus=${item.bonusIds.join(':')}`)
  if (item.gemIds.length) params.push(`gems=${item.gemIds.join(':')}`)
  if (item.enchantId) params.push(`ench=${item.enchantId}`)
  return {
    href: `https://www.wowhead.com/item=${item.itemId}`,
    data: params.join('&'),
  }
}

/** Spell tooltip params (ability breakdown icons, talents). */
export function buildSpellWowhead(spellId: number): {
  href: string
  data: string
} {
  return {
    href: `https://www.wowhead.com/spell=${spellId}`,
    data: `spell=${spellId}`,
  }
}
