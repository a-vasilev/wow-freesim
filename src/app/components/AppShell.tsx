import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CrossOriginIsolationBanner } from './CrossOriginIsolationBanner'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/styleguide', label: 'Styleguide' },
] as const

/** Layout shell: isolation banner, top nav, and the routed content region. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface text-fg min-h-screen">
      <CrossOriginIsolationBanner />

      <header className="border-border bg-surface-raised border-b">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-fg font-display text-lg font-semibold tracking-tight">
            FreeSim
          </span>
          <ul className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-fg-muted hover:text-fg text-sm transition-colors"
                  activeProps={{ className: 'text-accent' }}
                  activeOptions={{ exact: link.to === '/' }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
