import type { GearItem } from '@/engine'
import { WowheadAttribution } from '@/ui/wowhead'
import { useWowhead } from '@/ui/wowhead/wowhead'
import { SlotTile } from './SlotTile'
import { SLOT_ORDER } from './slots'

/**
 * Read-only gear panel (compose left pane, 310px — WEB_UI_PLAN §6.2). Slot tiles
 * driven by `ParsedCharacter.gear` ids; rich display from Wowhead at hover.
 */
export function GearPanel({
  gear,
  interactive = false,
}: {
  gear: GearItem[]
  interactive?: boolean
}) {
  useWowhead([gear])
  const bySlot = new Map(gear.map((g) => [g.slot, g]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {SLOT_ORDER.filter(
          (s) => bySlot.has(s.key) || s.key !== 'off_hand',
        ).map((slot) => (
          <SlotTile
            key={slot.key}
            label={slot.label}
            item={bySlot.get(slot.key)}
            interactive={interactive}
          />
        ))}
      </div>
      <WowheadAttribution className="text-fg-faint text-xs" />
    </div>
  )
}
