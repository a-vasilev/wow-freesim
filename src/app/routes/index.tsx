import { createFileRoute, Link } from '@tanstack/react-router'
import { ContentHeader } from '@/app/components/ContentHeader'
import { GearIcon, QuickSimIcon } from '@/ui/icons'
import {
  hardwareConcurrency,
  isCrossOriginIsolated,
} from '@/lib/crossOriginIsolated'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <ContentHeader title="Home" />
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-7 py-10">
        <Hero />

        <div className="grid gap-4 sm:grid-cols-2">
          <LaunchCard
            to="/quick-sim"
            icon={<QuickSimIcon className="size-5" />}
            title="Quick Sim"
            desc="Paste one /simc string and get a full DPS report — headline, ability breakdown, and uptimes."
          />
          <LaunchCard
            to="/gear"
            icon={<GearIcon className="size-5" />}
            title="Top Gear"
            desc="Sim every combination of the gear you already own in bags & bank, ranked by DPS."
          />
        </div>

        <GettingStarted />
      </section>
    </>
  )
}

function Hero() {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-accent text-xs font-semibold tracking-widest uppercase">
        Browser-native SimulationCraft
      </span>
      <h1 className="text-fg font-display max-w-2xl text-4xl font-semibold tracking-tight">
        Sim your character{' '}
        <span className="text-accent">on your own cores.</span>
      </h1>
      <p className="text-fg-muted max-w-2xl text-base">
        iLvl runs SimulationCraft entirely in your browser via WebAssembly — no
        queue, no server farm, no waiting in line. Your CPU does the work, so it
        stays fast and free. Paste your <code className="font-mono">/simc</code>{' '}
        string to begin.
      </p>
      <SystemStatus />
    </div>
  )
}

function LaunchCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      to={to}
      className="group border-border-subtle bg-surface-raised hover:border-accent focus-visible:ring-focus flex flex-col gap-3 rounded-lg border p-5 outline-none transition-colors focus-visible:ring-2"
    >
      <span className="bg-accent-subtle text-accent flex size-10 items-center justify-center rounded-md">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-fg group-hover:text-accent flex items-center gap-1.5 font-display text-lg font-semibold transition-colors">
          {title}
          <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <p className="text-fg-muted text-sm">{desc}</p>
      </div>
    </Link>
  )
}

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Copy your /simc string',
    body: (
      <>
        In WoW, install the SimulationCraft addon, type{' '}
        <code className="font-mono">/simc</code>, and copy the text it shows. For
        Top Gear, enable <span className="text-fg-subtle">bags &amp; bank</span>{' '}
        first.
      </>
    ),
  },
  {
    title: 'Pick a tool',
    body: 'Quick Sim for a single character report, or Top Gear to find the strongest set from gear you already own.',
  },
  {
    title: 'Read your report',
    body: 'DPS headline, ability breakdown, and buff/debuff uptimes — all computed locally and saved to your History.',
  },
]

function GettingStarted() {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-fg font-display text-2xl font-semibold">
        Getting started
      </h2>
      <ol className="flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="border-border-subtle text-accent font-display flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums">
              {i + 1}
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-fg text-sm font-semibold">
                {step.title}
              </span>
              <p className="text-fg-muted text-sm">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Demoted readiness line — the old PoC status grid, now a one-liner. */
function SystemStatus() {
  const isolated = isCrossOriginIsolated()
  const cores = hardwareConcurrency()
  return (
    <p className="text-fg-faint mt-1 flex items-center gap-2 text-xs">
      <span
        className={`size-2 shrink-0 rounded-full ${
          isolated ? 'bg-success' : 'bg-warning'
        }`}
        aria-hidden="true"
      />
      {isolated ? (
        <span>
          Engine ready · {cores} {cores === 1 ? 'core' : 'cores'} · multithreaded
        </span>
      ) : (
        <span className="text-warning">
          Not cross-origin isolated — multithreading is disabled this session.
        </span>
      )}
    </p>
  )
}

function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}
