/**
 * Shared dirty-switch guard (CHARACTER_PERSISTENCE §6.6). Wrap any action that
 * would replace the active draft (selecting a loadout, returning to the scratch
 * paste); if the draft has unsaved edits the action is staged behind a discard
 * confirmation. Render the returned `dialog` once in the host component.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/ui/Dialog'
import { useActiveDraft } from '@/features/session/activeDraftStore'

export function useDirtyGuard(): {
  guard: (run: () => void) => void
  dialog: ReactNode
} {
  const [pending, setPending] = useState<{ run: () => void } | null>(null)

  const guard = useCallback((run: () => void) => {
    if (useActiveDraft.getState().dirty) setPending({ run })
    else run()
  }, [])

  const dialog = (
    <ConfirmDialog
      open={pending != null}
      onOpenChange={(o) => !o && setPending(null)}
      title="Discard unsaved changes?"
      description="Your current edits aren't saved to a loadout. Switching will discard them."
      confirmLabel="Discard"
      tone="danger"
      onConfirm={() => {
        pending?.run()
        setPending(null)
      }}
    />
  )

  return { guard, dialog }
}
