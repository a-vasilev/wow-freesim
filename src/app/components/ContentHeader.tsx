import type { ReactNode } from 'react'

/**
 * The in-content header strip (DESIGN_SYSTEM §6): sticky, 52px, raised surface,
 * hairline bottom border. Left holds the section title (+ optional breadcrumb
 * tail and a segmented sub-tab row); the right slot (`margin-left: auto`) holds
 * setting chips / page actions. Constant across a route's states.
 */
export function ContentHeader({
  title,
  crumb,
  tabs,
  right,
}: {
  title: ReactNode
  /** Optional breadcrumb tail rendered faint after the title, e.g. "Report". */
  crumb?: ReactNode
  /** Optional segmented sub-tab row (SubTabs), placed left next to the title. */
  tabs?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="bg-surface-raised border-border-subtle sticky top-0 z-10 flex h-13 items-stretch gap-5 border-b px-7">
      <h1 className="text-fg font-display flex items-center gap-1.5 self-center text-sm font-semibold">
        <span>{title}</span>
        {crumb != null && (
          <span className="text-fg-faint font-normal">
            <span className="mr-1.5">›</span>
            {crumb}
          </span>
        )}
      </h1>
      {tabs != null && <div className="flex items-stretch gap-1">{tabs}</div>}
      {right != null && (
        <div className="ml-auto flex items-center gap-3">{right}</div>
      )}
    </header>
  )
}

/**
 * A single segmented sub-tab (DESIGN_SYSTEM §8.5): full-height link/button with a
 * 2px accent bottom border when active, sitting on the strip's bottom border.
 */
export function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative top-px flex items-center border-b-2 px-1 text-xs font-medium tracking-wide uppercase transition-colors ${
        active
          ? 'border-accent text-accent font-semibold'
          : 'text-fg-muted hover:text-fg border-transparent'
      }`}
    >
      {children}
    </button>
  )
}
