/**
 * Modal dialog primitive (DESIGN_SYSTEM §10 — focus-trapped, Escape/overlay to
 * close). A thin styled wrapper over Radix Dialog so confirm/save prompts share
 * one chrome: dimmed canvas overlay + a raised overlay-surface card. All semantic
 * tokens, no arbitrary values.
 */
import type { ReactNode } from 'react'
import * as RDialog from '@radix-ui/react-dialog'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        {/* Overlay IS the centering container: a click anywhere on the dimmed
            canvas (not just a hairline strip behind the card) lands on the Overlay
            and dismisses, per DESIGN_SYSTEM §10. Clicks on Content don't bubble a
            dismiss — Radix's DismissableLayer only closes on interaction outside it. */}
        <RDialog.Overlay className="bg-surface/70 fixed inset-0 z-50 flex items-center justify-center p-4">
          <RDialog.Content className="bg-surface-overlay border-border-subtle w-full max-w-md rounded-lg border p-5 shadow-lg outline-none">
            <RDialog.Title className="text-fg font-display text-base font-semibold">
              {title}
            </RDialog.Title>
            {description != null && (
              <RDialog.Description className="text-fg-muted mt-1.5 text-sm">
                {description}
              </RDialog.Description>
            )}
            {children}
          </RDialog.Content>
        </RDialog.Overlay>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/**
 * A two-button confirm prompt (e.g. the dirty-switch discard warning, §6.6).
 * `tone` colors the confirm button — `danger` for destructive confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'accent',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'accent' | 'danger'
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="border-border text-fg-muted hover:text-fg hover:border-border-strong rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
          className={
            tone === 'danger'
              ? 'bg-danger text-danger-fg rounded-md px-4 py-1.5 text-sm font-semibold transition-colors hover:opacity-90'
              : 'bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-4 py-1.5 text-sm font-semibold transition-colors'
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
