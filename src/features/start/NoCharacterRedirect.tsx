import { Link } from '@tanstack/react-router'

/**
 * Empty-state for a scenario reached without a loaded character. Since the
 * character source (saved / paste / Armory) now lives on the `/start` step, a
 * scenario no longer carries its own paste box — it points back to that step.
 */
export function NoCharacterRedirect({
  scenario,
}: {
  /** What the user was trying to do, e.g. "sim" / "find your best gear". */
  scenario: string
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h2 className="text-fg font-display text-lg font-semibold">
        No character loaded
      </h2>
      <p className="text-fg-muted text-sm">
        Load a character — pick a saved one, paste a{' '}
        <code className="font-mono">/simc</code> string, or pull it from the
        Armory — to {scenario}.
      </p>
      <Link
        to="/simulate"
        className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors"
      >
        Load a character
      </Link>
    </div>
  )
}
