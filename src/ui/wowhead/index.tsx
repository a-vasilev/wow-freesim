import type { AnchorHTMLAttributes, ReactNode } from 'react'
import type { GearItem } from '@/engine'
import { buildItemWowhead, buildSpellWowhead } from './wowhead'

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

/** A Wowhead-enhanced item link (tooltip + iconized, quality-colored by the script). */
export function WowheadItem({
  item,
  children,
  ...rest
}: { item: GearItem; children?: ReactNode } & AnchorProps) {
  const { href, data } = buildItemWowhead(item)
  return (
    <a href={href} data-wowhead={data} rel="noreferrer" {...rest}>
      {children}
    </a>
  )
}

/** A Wowhead-enhanced spell link (ability icons, talents). */
export function WowheadSpell({
  spellId,
  children,
  ...rest
}: { spellId: number; children?: ReactNode } & AnchorProps) {
  const { href, data } = buildSpellWowhead(spellId)
  return (
    <a href={href} data-wowhead={data} rel="noreferrer" {...rest}>
      {children}
    </a>
  )
}

/** Visible attribution required by our use of the Wowhead embed (OVERALL_PLAN §6). */
export function WowheadAttribution({ className }: { className?: string }) {
  return (
    <p className={className}>
      Item &amp; spell data from{' '}
      <a
        href="https://www.wowhead.com"
        target="_blank"
        rel="noreferrer"
        className="text-accent hover:text-accent-hover"
      >
        Wowhead
      </a>
      .
    </p>
  )
}
