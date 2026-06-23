import type { Uptime } from '@/engine'

/** Buff & debuff uptime cards (DESIGN_SYSTEM §8.12). */
export function UptimeGrid({
  title,
  uptimes,
}: {
  title: string
  uptimes: Uptime[]
}) {
  if (!uptimes.length) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-fg font-display text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {uptimes.map((u, i) => (
          <div
            key={`${u.spellId ?? u.name}-${i}`}
            className="border-border-subtle bg-surface-inset flex flex-col gap-1.5 rounded-md border px-3.5 py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-fg-muted truncate text-xs font-medium">
                {u.name}
              </span>
              <span className="text-fg font-display text-sm font-semibold tabular-nums">
                {u.uptimePct.toFixed(1)}%
              </span>
            </div>
            <div className="bg-surface-raised h-0.5 w-full overflow-hidden rounded-full">
              {/* uptime bar width = allowlisted inline geometry (§11) */}
              {/* eslint-disable no-restricted-syntax */}
              <div
                className="bg-accent h-full rounded-full opacity-50"
                style={{ width: `${Math.min(100, u.uptimePct)}%` }}
              />
              {/* eslint-enable no-restricted-syntax */}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
