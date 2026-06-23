import type { ReactNode } from 'react'
import { CrossOriginIsolationBanner } from './CrossOriginIsolationBanner'
import { Sidebar } from './Sidebar'

/**
 * App shell (DESIGN_SYSTEM §6): the 220px sidebar + the main content region.
 * The isolation banner spans the top; routes render their own 52px content
 * header strip (ContentHeader) as the first child of the content region.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface text-fg min-h-screen">
      <CrossOriginIsolationBanner />
      <div className="flex items-start">
        <Sidebar />
        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
