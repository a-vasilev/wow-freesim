import { useState } from 'react'
import type { ParsedCharacter } from '@/engine'

/**
 * Read-only talent view. The full tree grid (WEB_UI_PLAN §6.5) needs the simc
 * talent-tree definition bundle, which is NOT in engine release v1205.01 — so we
 * ship the §6.5 GRACEFUL FALLBACK: the loadout import string (copyable) plus any
 * named selected nodes simc provides. When the tree bundle lands, the full grid
 * replaces this with no other UI change.
 */
export function TalentPanel({
  talents,
}: {
  talents: ParsedCharacter['talents']
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(talents.loadout)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-fg font-display text-sm font-semibold">Talents</h2>
        <span className="text-fg-faint text-xs">
          Full tree pending the engine talent bundle
        </span>
      </div>

      {talents.selected.length > 0 && (
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {talents.selected.map((n) => (
            <li key={n.id} className="text-fg-muted font-mono">
              #{n.id}
              {n.rank > 1 ? ` ×${n.rank}` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="border-border-subtle bg-surface-inset flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-fg-subtle text-xs font-semibold tracking-wide uppercase">
            Loadout string
          </span>
          <button
            type="button"
            onClick={copy}
            className="border-border text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <code className="text-fg-muted font-mono text-xs break-all">
          {talents.loadout || '— none —'}
        </code>
      </div>
    </div>
  )
}
