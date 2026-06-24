import { useEffect, type ReactNode } from 'react'
import type { GearItem } from '@/engine'
import {
  buildItemWowhead,
  loadWowhead,
  refreshWowhead,
} from '@/ui/wowhead/wowhead'
import { useItemDisplay } from './itemDisplay'

const QUESTIONMARK =
  'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'

/** simc name token → readable fallback shown until Wowhead supplies the real name. */
function humanize(name?: string): string {
  if (!name) return 'Item'
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Wowhead quality tier (q0..q5) → our quality tokens. */
const QUALITY: Record<number, { text: string; border: string }> = {
  0: { text: 'text-quality-common', border: 'border-quality-common' },
  1: { text: 'text-quality-common', border: 'border-quality-common' },
  2: { text: 'text-quality-uncommon', border: 'border-quality-uncommon' },
  3: { text: 'text-quality-rare', border: 'border-quality-rare' },
  4: { text: 'text-quality-epic', border: 'border-quality-epic' },
  5: { text: 'text-quality-legendary', border: 'border-quality-legendary' },
}

export type ItemCellSize = 'sm' | 'md'

export interface ItemCellProps {
  item: GearItem
  /** Slot eyebrow above the name (paperdoll tiles / picker rows). */
  label?: string
  /** Icon size hint (reserved; both render a 40px icon today). */
  size?: ItemCellSize
  /** Selectable cell (Top Gear picker) — whole box toggles, never navigates. */
  interactive?: boolean
  selected?: boolean
  /** Marks the equipped baseline pick ("Equipped" tag). */
  equipped?: boolean
  onToggle?: () => void
  /** Right-aligned trailing content (DPS / Δ column on candidate rows). */
  trailing?: ReactNode
}

/**
 * The single item-display primitive (DESIGN_SYSTEM §8.6 / §8.7). Renders entirely
 * from React-owned state (the per-item display cache), so it is correct on every
 * mount/re-mount. The cache is filled by a one-time JSON fetch (see itemDisplay.ts);
 * the Wowhead Power script is used only to bind the hover tooltip — never to paint
 * our visible markup, and never to navigate away to wowhead.com.
 */
export function ItemCell({
  item,
  label,
  interactive = false,
  selected = false,
  equipped = false,
  onToggle,
  trailing,
}: ItemCellProps) {
  const { href, data } = buildItemWowhead(item)
  const fallbackName = humanize(item.name)
  const display = useItemDisplay(item.itemId)

  // Bind the live hover tooltip whenever a cell mounts (display data itself comes
  // from the JSON fetch in useItemDisplay, not from this script).
  useEffect(() => {
    loadWowhead().then(refreshWowhead)
  }, [item.itemId])

  const name = display?.name || fallbackName
  const iconUrl = display?.iconUrl ?? QUESTIONMARK
  const quality = display?.qualityTier != null ? QUALITY[display.qualityTier] : null
  const nameColor = quality?.text ?? 'text-fg-muted'
  const borderColor = quality?.border ?? 'border-border'

  const stateClasses = interactive
    ? selected
      ? 'border-accent bg-accent-subtle cursor-pointer'
      : 'border-border-subtle hover:border-border hover:bg-surface-inset cursor-pointer'
    : 'border-border-subtle bg-surface-inset'

  const interactiveProps = interactive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-pressed': selected,
        onClick: onToggle,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle?.()
          }
        },
      }
    : {}

  return (
    <div
      className={`flex items-center gap-2.5 rounded-md border p-2 transition-colors ${stateClasses}`}
      {...interactiveProps}
    >
      <span
        className={`relative size-10 shrink-0 overflow-hidden rounded-sm border ${borderColor}`}
      >
        <img
          src={iconUrl}
          alt=""
          aria-hidden="true"
          className="size-full object-cover"
        />
        {/* Transparent tooltip anchor over the icon: hover shows the Wowhead
            tooltip; iconize/rename off so it injects nothing; preventDefault kills
            navigation; the click bubbles to the cell so the whole box selects. */}
        <a
          href={href}
          data-wowhead={data}
          data-wh-iconize-link="false"
          data-wh-rename-link="false"
          rel="noreferrer"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => e.preventDefault()}
          className="absolute inset-0"
        />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {label && (
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            {label}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate text-sm ${nameColor}`}>{name}</span>
          {equipped && (
            <span className="text-fg-faint shrink-0 text-xs font-semibold tracking-wide uppercase">
              Equipped
            </span>
          )}
        </div>
        <ItemMeta item={item} />
      </div>

      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

/** ilvl + socket + enchant meta row, from our id-only model. */
function ItemMeta({ item }: { item: GearItem }) {
  const hasGem = item.gemIds.length > 0
  const hasEnchant = item.enchantId != null
  if (item.ilvl == null && !hasGem && !hasEnchant) return null
  return (
    <div className="text-fg-faint flex items-center gap-2 text-xs tabular-nums">
      {item.ilvl != null && (
        <span className="text-tooltip-info font-display font-semibold">
          {item.ilvl}
        </span>
      )}
      {hasGem && (
        <span
          className="text-tooltip-info"
          title="Gem socket"
          aria-label="Gem socket"
        >
          ◆
        </span>
      )}
      {hasEnchant && (
        <span className="text-tooltip-effect" title="Enchanted">
          Ench
        </span>
      )}
    </div>
  )
}
