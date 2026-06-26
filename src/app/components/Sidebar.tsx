import type { ComponentType, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { EngineStatusChip } from '@/ui/EngineStatusChip'
import {
  DroptimizerIcon,
  GearIcon,
  HistoryIcon,
  QuickSimIcon,
  RosterIcon,
} from '@/ui/icons'
import { Brand } from './Brand'
import { useSidebar } from './sidebar-store'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

interface NavRoute {
  to: string
  label: string
  icon: IconType
  exact?: boolean
}

// Live routes (DESIGN_SYSTEM §6 nav order). Droptimizer is Phase 3 and renders as
// a disabled "Soon" row so the shell matches spec without a dead link.
const NAV_ROUTES: NavRoute[] = [
  { to: '/quick-sim', label: 'Quick Sim', icon: QuickSimIcon },
  { to: '/gear', label: 'Top Gear', icon: GearIcon },
  { to: '/characters', label: 'Characters', icon: RosterIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
]

const SOON_ROUTES: { label: string; icon: IconType }[] = [
  { label: 'Droptimizer', icon: DroptimizerIcon },
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
        {SOON_ROUTES.map((r) => (
          <SoonItem
            key={r.label}
            label={r.label}
            icon={r.icon}
            collapsed={collapsed}
          />
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

function SoonItem({
  label,
  icon: Icon,
  collapsed,
}: {
  label: string
  icon: IconType
  collapsed: boolean
}) {
  return (
    <div
      className={`text-fg-faint flex cursor-not-allowed items-center text-sm select-none ${
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-5 py-2.5'
      }`}
      aria-disabled="true"
      title={collapsed ? `${label} — coming soon` : `${label} — coming in a later phase`}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span>{label}</span>
          <span className="border-border-subtle text-fg-faint ml-auto rounded-full border px-1.5 py-0.5 text-xs tracking-wide uppercase">
            Soon
          </span>
        </>
      )}
    </div>
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
