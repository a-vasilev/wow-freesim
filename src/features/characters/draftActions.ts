/**
 * Bridge between the Character library and the one shared active draft. Selecting
 * a loadout loads its `base`/`edits` into the draft, binds to it, and records it
 * as the character's last-used loadout (§7.1/§6.5).
 */
import { useActiveDraft } from '@/features/session/activeDraftStore'
import { setActiveLoadout } from './repository'
import type { Character, Loadout } from './types'

/** Bind the draft to a loadout, loading its content (the run/select action). */
export function applyLoadout(character: Character, loadout: Loadout): void {
  useActiveDraft
    .getState()
    .selectLoadout(
      { characterId: character.id, loadoutId: loadout.id },
      loadout.base,
      loadout.edits,
    )
  void setActiveLoadout(character.id, loadout.id)
}

/** The character's last-used loadout, falling back to the first. */
export function activeLoadoutOf(character: Character): Loadout {
  return (
    character.loadouts.find((l) => l.id === character.activeLoadoutId) ??
    character.loadouts[0]
  )
}
