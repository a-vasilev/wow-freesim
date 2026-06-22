import { createFileRoute, Link } from '@tanstack/react-router'
import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const isolated = isCrossOriginIsolated()

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-fg text-3xl font-semibold">wow-freesim</h1>
        <p className="text-fg-muted max-w-2xl">
          Browser-based SimulationCraft — sims run client-side on your own CPU
          cores via WebAssembly, no server farm. This is the Phase&nbsp;U0
          foundation: the theming spine, app shell, routing skeleton, and the
          cross-origin-isolation guard. The engine seam and Quick&nbsp;Sim land
          in the next phases.
        </p>
      </div>

      <dl className="border-border bg-border grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-lg border">
        <StatusCell label="Cross-origin isolated" ok={isolated}>
          {isolated ? 'yes' : 'no'}
        </StatusCell>
        <StatusCell label="Logical cores" ok>
          {hardwareConcurrency()}
        </StatusCell>
      </dl>

      <p className="text-fg-muted text-sm">
        Explore the token surface on the{' '}
        <Link to="/styleguide" className="text-accent hover:text-accent-hover">
          styleguide
        </Link>
        .
      </p>
    </section>
  )
}

function StatusCell({
  label,
  ok,
  children,
}: {
  label: string
  ok: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-raised flex flex-col gap-1 p-4">
      <dt className="text-fg-subtle text-xs uppercase">{label}</dt>
      <dd className={ok ? 'text-fg text-lg' : 'text-danger text-lg'}>
        {children}
      </dd>
    </div>
  )
}
