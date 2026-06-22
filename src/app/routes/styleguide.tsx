import type { ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useThemeStore } from '@/theme'

export const Route = createFileRoute('/styleguide')({
  component: StyleguidePage,
})

function StyleguidePage() {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg text-3xl font-semibold">Styleguide</h1>
        <p className="text-fg-muted max-w-2xl">
          The full token surface. This is the canvas the design phase dresses:
          every value below resolves through a design token, so restyling means
          editing the token files (<Code>src/theme</Code>), not components.
        </p>
        <p className="text-fg-subtle text-sm">
          Active theme: <Code>{theme}</Code>
        </p>
      </header>

      <Section
        title="Semantic colors"
        note="Intent-named tokens — the only colors components reference."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SEMANTIC_BG.map((s) => (
            <figure
              key={s.token}
              className="border-border bg-surface-raised flex flex-col gap-2 overflow-hidden rounded-lg border"
            >
              <div className={`h-16 w-full ${s.swatchClass}`} />
              <figcaption className="flex flex-col gap-0.5 px-3 pb-3">
                <span className="text-fg text-sm">{s.token}</span>
                <span className="text-fg-subtle text-xs">{s.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="border-border bg-surface-raised mt-4 flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-fg">text-fg — primary foreground</p>
          <p className="text-fg-muted">text-fg-muted — secondary text</p>
          <p className="text-fg-subtle">
            text-fg-subtle — tertiary / placeholder
          </p>
          <p className="text-accent">text-accent — links / interactive</p>
          <p className="text-danger">text-danger — error text</p>
        </div>
      </Section>

      <Section
        title="Primitive palette"
        note="Raw scales. Never used in markup — semantic tokens point here."
      >
        {PRIMITIVE_RAMPS.map((ramp) => (
          <div key={ramp.name} className="mb-4 flex flex-col gap-2">
            <h3 className="text-fg-muted text-sm">{ramp.name}</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              {ramp.steps.map((varName) => (
                <PrimitiveSwatch key={varName} varName={varName} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Typography" note="Font families and the type scale.">
        <div className="flex flex-col gap-4">
          <p className="text-fg font-sans text-lg">
            font-sans — The quick brown fox jumps over the lazy dog
          </p>
          <p className="text-fg font-mono text-lg">
            font-mono — target_error=0.1 iterations=10000
          </p>
        </div>
        <div className="border-border mt-6 flex flex-col gap-3 border-t pt-6">
          {TYPE_SCALE.map((t) => (
            <div key={t.cls} className="flex items-baseline gap-4">
              <span className="text-fg-subtle w-16 shrink-0 text-xs">
                {t.cls}
              </span>
              <span className={`text-fg ${t.cls}`}>Sim the night away</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radius" note="Corner rounding scale.">
        <div className="flex flex-wrap gap-6">
          {RADII.map((r) => (
            <div key={r.cls} className="flex flex-col items-center gap-2">
              <div
                className={`border-border-strong bg-surface-raised h-20 w-20 border ${r.cls}`}
              />
              <span className="text-fg-subtle text-xs">{r.cls}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadow" note="Elevation scale.">
        <div className="flex flex-wrap gap-8">
          {SHADOWS.map((s) => (
            <div key={s.cls} className="flex flex-col items-center gap-2">
              <div
                className={`bg-surface-raised h-20 w-20 rounded-lg ${s.cls}`}
              />
              <span className="text-fg-subtle text-xs">{s.cls}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Spacing"
        note="Tailwind 4px-grid scale (arbitrary values are lint-banned)."
      >
        <div className="flex flex-col gap-3">
          {SPACING.map((s) => (
            <div key={s.cls} className="flex items-center gap-4">
              <span className="text-fg-subtle w-12 shrink-0 text-xs">
                {s.cls}
              </span>
              <div className={`bg-accent h-4 rounded-sm ${s.cls}`} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-border flex flex-col gap-1 border-b pb-2">
        <h2 className="text-fg text-xl font-semibold">{title}</h2>
        <p className="text-fg-subtle text-sm">{note}</p>
      </div>
      {children}
    </section>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-surface-overlay text-fg rounded-sm px-1 py-0.5 font-mono text-sm">
      {children}
    </code>
  )
}

function PrimitiveSwatch({ varName }: { varName: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Styleguide is the one allowlisted place raw primitives are surfaced:
          no utility class exists for them by design (they are not in @theme). */}
      {/* eslint-disable no-restricted-syntax */}
      <div
        className="border-border h-12 w-full rounded-md border"
        style={{ backgroundColor: `var(${varName})` }}
      />
      {/* eslint-enable no-restricted-syntax */}
      <span className="text-fg-subtle text-xs">
        {varName.replace('--', '')}
      </span>
    </div>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────
// className strings are literals so Tailwind's scanner generates the utilities.

const SEMANTIC_BG = [
  { token: 'bg-surface', swatchClass: 'bg-surface', note: 'app background' },
  {
    token: 'bg-surface-raised',
    swatchClass: 'bg-surface-raised',
    note: 'cards / panels',
  },
  {
    token: 'bg-surface-overlay',
    swatchClass: 'bg-surface-overlay',
    note: 'modals / popovers',
  },
  { token: 'bg-accent', swatchClass: 'bg-accent', note: 'interactive' },
  {
    token: 'bg-accent-hover',
    swatchClass: 'bg-accent-hover',
    note: 'interactive hover',
  },
  { token: 'bg-danger', swatchClass: 'bg-danger', note: 'errors' },
  { token: 'bg-success', swatchClass: 'bg-success', note: 'success' },
  { token: 'bg-warning', swatchClass: 'bg-warning', note: 'warnings' },
  { token: 'bg-border', swatchClass: 'bg-border', note: 'default border' },
  {
    token: 'bg-border-strong',
    swatchClass: 'bg-border-strong',
    note: 'strong border',
  },
  { token: 'bg-dps', swatchClass: 'bg-dps', note: 'DPS series' },
  { token: 'bg-chart-1', swatchClass: 'bg-chart-1', note: 'chart hue 1' },
  { token: 'bg-chart-2', swatchClass: 'bg-chart-2', note: 'chart hue 2' },
  { token: 'bg-chart-3', swatchClass: 'bg-chart-3', note: 'chart hue 3' },
  { token: 'bg-chart-4', swatchClass: 'bg-chart-4', note: 'chart hue 4' },
  { token: 'bg-chart-5', swatchClass: 'bg-chart-5', note: 'chart hue 5' },
  { token: 'bg-chart-6', swatchClass: 'bg-chart-6', note: 'chart hue 6' },
] as const

const PRIMITIVE_RAMPS = [
  {
    name: 'gray',
    steps: [
      '--gray-50',
      '--gray-100',
      '--gray-200',
      '--gray-300',
      '--gray-400',
      '--gray-500',
      '--gray-600',
      '--gray-700',
      '--gray-800',
      '--gray-900',
      '--gray-950',
    ],
  },
  { name: 'blue', steps: ['--blue-400', '--blue-500', '--blue-600'] },
  { name: 'red', steps: ['--red-400', '--red-500', '--red-600'] },
  { name: 'green', steps: ['--green-400', '--green-500'] },
  { name: 'amber', steps: ['--amber-400', '--amber-500'] },
  {
    name: 'chart hues',
    steps: ['--hue-1', '--hue-2', '--hue-3', '--hue-4', '--hue-5', '--hue-6'],
  },
] as const

const TYPE_SCALE = [
  { cls: 'text-xs' },
  { cls: 'text-sm' },
  { cls: 'text-base' },
  { cls: 'text-lg' },
  { cls: 'text-xl' },
  { cls: 'text-2xl' },
  { cls: 'text-3xl' },
] as const

const RADII = [
  { cls: 'rounded-sm' },
  { cls: 'rounded-md' },
  { cls: 'rounded-lg' },
  { cls: 'rounded-xl' },
  { cls: 'rounded-full' },
] as const

const SHADOWS = [
  { cls: 'shadow-sm' },
  { cls: 'shadow-md' },
  { cls: 'shadow-lg' },
] as const

const SPACING = [
  { cls: 'w-1' },
  { cls: 'w-2' },
  { cls: 'w-4' },
  { cls: 'w-6' },
  { cls: 'w-8' },
  { cls: 'w-12' },
  { cls: 'w-16' },
  { cls: 'w-24' },
] as const
