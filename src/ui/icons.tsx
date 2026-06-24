/**
 * UI affordance icons (DESIGN_SYSTEM §7): simple inline-SVG line icons, 16×16,
 * stroke 1.4, round caps, `currentColor` so they recolor with component state.
 * These are NOT WoW item/ability art (that's the Wowhead icon CDN).
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
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
      {children}
    </svg>
  )
}

/** Quick Sim — lightning bolt (DESIGN_SYSTEM §7 reference glyph). */
export function QuickSimIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" />
    </Icon>
  )
}

/** Gear / Top Gear — chestplate silhouette. */
export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 3l4 1.5L12 3v6.5a3 3 0 0 1-1.6 2.65L8 13.5l-2.4-1.35A3 3 0 0 1 4 9.5V3z" />
      <path d="M8 4.5v9" />
    </Icon>
  )
}

/** Droptimizer — droplet falling into a tray. */
export function DroptimizerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.5c1.8 2.2 3 3.8 3 5.2a3 3 0 0 1-6 0c0-1.4 1.2-3 3-5.2z" />
      <path d="M3 13h10" />
    </Icon>
  )
}

/** History — clock with a counter-clockwise arrow. */
export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
      <path d="M2.2 3v2.6h2.6" />
      <path d="M8 5.2V8l1.8 1.1" />
    </Icon>
  )
}

/** Advanced — angle brackets (raw .simc editor). */
export function AdvancedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4.5L2.5 8 6 11.5" />
      <path d="M10 4.5L13.5 8 10 11.5" />
    </Icon>
  )
}

/** Settings — gear cog. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7L3.5 3.5" />
    </Icon>
  )
}
