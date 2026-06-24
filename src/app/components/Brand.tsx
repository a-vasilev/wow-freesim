import { Link } from '@tanstack/react-router'

/**
 * Brand lockup (DESIGN_SYSTEM §2): the "Upgrade" mark + "iLvl" wordmark.
 * The mark is two green up-arrows side by side — the in-game cue you see when an
 * item is a big upgrade. Drawn with `currentColor` under `text-delta-positive`
 * (= --green-400, the on-token "gear gain" green), so it stays on-token. The
 * wordmark's leading "i" dot is replaced by a gold diamond. Links to the app root.
 */
export function Brand() {
  return (
    <Link
      to="/"
      className="focus-visible:ring-focus flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2"
      aria-label="iLvl — home"
    >
      <UpgradeMark />
      <Wordmark />
    </Link>
  )
}

function UpgradeMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 38 38"
      className="text-delta-positive shrink-0"
      aria-hidden="true"
    >
      {/* Two up-arrows side by side — the in-game "upgrade" cue. Each has a flat,
          wide head over a short, wide stem. On-token fill; the pair fills the
          38×38 box (x 1→37, y 9→29) so it reads large next to the text. */}
      <path
        d="M9.5 9 L18 18 L14 18 L14 29 L5 29 L5 18 L1 18 Z"
        fill="currentColor"
      />
      <path
        d="M28.5 9 L37 18 L33 18 L33 29 L24 29 L24 18 L20 18 Z"
        fill="currentColor"
      />
    </svg>
  )
}

function Wordmark() {
  return (
    <span className="text-fg font-display text-lg font-semibold tracking-tight">
      iLvl
    </span>
  )
}
