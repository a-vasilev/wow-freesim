import type { GearItem } from '@/engine'
import { ItemCell } from '@/ui/item/ItemCell'

/**
 * Read-only item slot tile (DESIGN_SYSTEM §8.6). Delegates all item chrome to the
 * shared `ItemCell` (icon, quality border, name, ilvl/socket/enchant meta, the
 * Wowhead tooltip); renders a dim placeholder for an empty slot.
 */
export function SlotTile({
  label,
  item,
  interactive = false,
}: {
  label: string
  item?: GearItem
  interactive?: boolean
}) {
  if (!item) {
    return (
      <div className="border-border-subtle bg-surface-inset flex items-center gap-2 rounded-md border p-2 opacity-45">
        <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <span className="text-fg-faint text-sm italic">Empty</span>
      </div>
    )
  }
  return (
    <ItemCell item={item} label={label} size="sm" interactive={interactive} />
  )
}
