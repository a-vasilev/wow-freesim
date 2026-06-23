import { Link } from '@tanstack/react-router'

/**
 * Brand lockup (DESIGN_SYSTEM §2): the "A1 Convergence" mark + "W1" wordmark.
 * The mark's arcs are drawn with `currentColor` under `text-accent` (= --gold-400),
 * keeping it on-token; per-arc opacity creates the depth illusion. The wordmark's
 * "i" dot is replaced by a gold diamond. Links to the app root.
 */
export function Brand() {
  return (
    <Link
      to="/"
      className="focus-visible:ring-focus flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2"
      aria-label="FreeSim — home"
    >
      <A1Mark />
      <Wordmark />
    </Link>
  )
}

function A1Mark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 38 38"
      fill="none"
      className="text-accent shrink-0"
      aria-hidden="true"
    >
      <path
        d="M 6 19 A 13 13 0 0 1 19 6"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M 32 19 A 13 13 0 0 1 19 32"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M 9.5 19 A 9.5 9.5 0 0 1 19 9.5"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M 28.5 19 A 9.5 9.5 0 0 1 19 28.5"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M 13 19 A 6 6 0 0 1 19 13"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 25 19 A 6 6 0 0 1 19 25"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="19" cy="19" r="2.2" fill="currentColor" />
    </svg>
  )
}

function Wordmark() {
  return (
    <span className="text-fg font-display text-lg leading-none font-semibold tracking-tight">
      FreeS
      <span className="relative inline-block">
        i{/* gold diamond replacing the "i" dot (DESIGN_SYSTEM §2 / W1) */}
        <span className="bg-accent absolute -top-0.5 left-1/2 size-1 -translate-x-1/2 rotate-45 rounded-sm" />
      </span>
      m
    </span>
  )
}
