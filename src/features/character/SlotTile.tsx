import type { GearItem } from '@/engine'
import { WowheadItem } from '@/ui/wowhead'

function humanize(name?: string): string {
  if (!name) return 'Item'
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Read-only item slot tile (DESIGN_SYSTEM §8.6). Icon, quality color, and full
 * tooltip are rendered by the Wowhead Power script from the item ids — we supply
 * the slot label + ilvl. The `interactive` prop is the editing seam (inert now).
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
        <SlotLabel>{label}</SlotLabel>
        <span className="text-fg-faint text-sm italic">Empty</span>
      </div>
    )
  }
  return (
    <div
      className={`border-border-subtle bg-surface-inset flex flex-col gap-0.5 rounded-md border p-2 transition-colors ${
        interactive ? 'hover:border-border hover:bg-surface-overlay cursor-pointer' : ''
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <SlotLabel>{label}</SlotLabel>
        {item.ilvl != null && (
          <span className="text-tooltip-ilvl font-display text-xs font-bold">
            {item.ilvl}
          </span>
        )}
      </div>
      <WowheadItem
        item={item}
        className="text-fg-muted hover:text-fg flex items-center gap-1.5 text-sm focus-visible:outline-none"
      >
        {humanize(item.name)}
      </WowheadItem>
    </div>
  )
}

function SlotLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
      {children}
    </span>
  )
}
