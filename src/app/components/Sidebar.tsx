import type { ComponentType, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { EngineStatusChip } from '@/ui/EngineStatusChip'
import {
  DroptimizerIcon,
  GearIcon,
  HistoryIcon,
  QuickSimIcon,
} from '@/ui/icons'
import { Brand } from './Brand'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

interface NavRoute {
  to: string
  label: string
  icon: IconType
  exact?: boolean
}

// Live routes (DESIGN_SYSTEM §6 nav order). Gear + Droptimizer are Phase 2/3 and
// render as disabled "Soon" rows so the shell matches spec without dead links.
const NAV_ROUTES: NavRoute[] = [
  { to: '/quick-sim', label: 'Quick Sim', icon: QuickSimIcon },
  { to: '/history', label: 'History', icon: HistoryIcon },
]

const SOON_ROUTES: { label: string; icon: IconType }[] = [
  { label: 'Gear', icon: GearIcon },
  { label: 'Droptimizer', icon: DroptimizerIcon },
]

/**
 * Left sidebar (DESIGN_SYSTEM §6 / §8.1): brand block, nav list, engine-status
 * footer. Sticky, full-height; 196px narrow / 220px at xl. Always visible on
 * desktop — the primary navigation shell across every route.
 */
export function Sidebar() {
  return (
    <aside className="bg-surface-inset border-border-subtle sticky top-0 flex h-screen w-49 shrink-0 flex-col border-r xl:w-55">
      <div className="border-border-subtle border-b px-5 py-6">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 py-3">
        {NAV_ROUTES.map((r) => (
          <NavItem key={r.to} route={r} />
        ))}
        {SOON_ROUTES.map((r) => (
          <SoonItem key={r.label} label={r.label} icon={r.icon} />
        ))}
      </nav>

      <div className="border-border-subtle flex items-center gap-2 border-t px-4 py-3.5">
        <EngineStatusChip />
      </div>
    </aside>
  )
}

function NavItem({ route }: { route: NavRoute }) {
  const Icon = route.icon
  return (
    <Link
      to={route.to}
      activeOptions={{ exact: route.exact ?? false }}
      className="text-fg-muted hover:bg-surface-overlay relative flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
      activeProps={{ className: 'bg-accent-subtle text-accent font-medium' }}
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive && (
            <span className="bg-accent absolute top-2 bottom-2 left-0 w-0.5 rounded-sm" />
          )}
          <Icon className="size-4 shrink-0" />
          <span>{route.label}</span>
        </>
      )}
    </Link>
  )
}

function SoonItem({ label, icon: Icon }: { label: string; icon: IconType }) {
  return (
    <div
      className="text-fg-faint flex cursor-not-allowed items-center gap-3 px-5 py-2.5 text-sm select-none"
      aria-disabled="true"
      title={`${label} — coming in a later phase`}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      <span className="border-border-subtle text-fg-faint ml-auto rounded-full border px-1.5 py-0.5 text-xs tracking-wide uppercase">
        Soon
      </span>
    </div>
  )
}
