import type { ComponentType, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { EngineStatusChip } from '@/ui/EngineStatusChip'
import { HistoryIcon, RosterIcon, StartIcon } from '@/ui/icons'
import { Brand } from './Brand'
import { useSidebar } from './sidebar-store'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

interface NavRoute {
  to: string
  label: string
  icon: IconType
  exact?: boolean
}

// Live routes. The sim scenarios (Quick Sim / Top Gear / Droptimizer) are no longer
// top-level nav: every sim is reached through the single **Simulate** flow, which
// picks the character first and then the scenario to run.
const NAV_ROUTES: NavRoute[] = [
  { to: '/simulate', label: 'Simulate', icon: StartIcon },
  { to: '/characters', label: 'Characters', icon: RosterIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
]

/**
 * Left sidebar (DESIGN_SYSTEM §6 / §8.1): brand block, nav list, engine-status
 * footer. Sticky, full-height. Collapses to a 56px icon-rail — either by the
 * user's persisted toggle or forced on narrow viewports (where the full width is
 * too costly). In the rail, labels become hover tooltips.
 */
export function Sidebar() {
  const userCollapsed = useSidebar((s) => s.collapsed)
  const toggle = useSidebar((s) => s.toggle)
  // Below this width the rail is forced (and the manual toggle is hidden).
  const forced = useMediaQuery('(max-width: 1023px)')
  const collapsed = userCollapsed || forced

  return (
    <aside
      className={`bg-surface-inset border-border-subtle sticky top-0 flex h-screen shrink-0 flex-col border-r ${
        collapsed ? 'w-14' : 'w-49 xl:w-55'
      }`}
    >
      <div
        className={`border-border-subtle border-b ${
          collapsed ? 'flex justify-center px-2 py-5' : 'px-5 py-6'
        }`}
      >
        <Brand markOnly={collapsed} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 py-3">
        {NAV_ROUTES.map((r) => (
          <NavItem key={r.to} route={r} collapsed={collapsed} />
        ))}
      </nav>

      <div
        className={`border-border-subtle border-t ${
          collapsed
            ? 'flex flex-col items-center gap-2 px-2 py-3'
            : 'flex items-center justify-between gap-2 px-4 py-3.5'
        }`}
      >
        <EngineStatusChip compact={collapsed} />
        {!forced && (
          <CollapseToggle collapsed={userCollapsed} onToggle={toggle} />
        )}
      </div>
    </aside>
  )
}

function NavItem({
  route,
  collapsed,
}: {
  route: NavRoute
  collapsed: boolean
}) {
  const Icon = route.icon
  return (
    <Link
      to={route.to}
      activeOptions={{ exact: route.exact ?? false }}
      title={collapsed ? route.label : undefined}
      className={`text-fg-muted hover:bg-surface-overlay relative flex items-center text-sm transition-colors ${
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-5 py-2.5'
      }`}
      activeProps={{ className: 'bg-accent-subtle text-accent font-medium' }}
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive && (
            <span className="bg-accent absolute top-2 bottom-2 left-0 w-0.5 rounded-sm" />
          )}
          <Icon className="size-4 shrink-0" />
          {!collapsed && <span>{route.label}</span>}
        </>
      )}
    </Link>
  )
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="text-fg-faint hover:text-fg-muted hover:bg-surface-overlay flex items-center justify-center rounded-md p-1.5 transition-colors"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        <path d="M10 3L5 8l5 5" />
        <path d="M13.5 3v10" />
      </svg>
    </button>
  )
}
