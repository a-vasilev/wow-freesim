import { useState } from 'react'
import { useActiveDraft } from '@/features/session/activeDraftStore'
import {
  ArmoryError,
  fetchArmoryProfile,
  type ArmoryRegion,
} from './fetchArmory'

const REGIONS: { value: ArmoryRegion; label: string }[] = [
  { value: 'us', label: 'US' },
  { value: 'eu', label: 'EU' },
  { value: 'kr', label: 'KR' },
  { value: 'tw', label: 'TW' },
]

/**
 * Import a character straight from the Blizzard Armory: region + realm + name →
 * same-origin Function → client transform → `setBase()`. On success the built simc
 * string flows into the shared active draft, reusing the whole existing
 * inspect→run→save pipeline (no special-casing downstream).
 *
 * Talents can't be imported while Blizzard's specializations endpoint omits the
 * loadout code (broken since 11.2); we surface that as a non-blocking notice rather
 * than failing the import.
 */
export function ArmoryImportForm() {
  const setBase = useActiveDraft((d) => d.setBase)
  const [region, setRegion] = useState<ArmoryRegion>('us')
  const [realm, setRealm] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [talentNotice, setTalentNotice] = useState(false)

  const canSubmit = realm.trim() !== '' && name.trim() !== '' && status !== 'loading'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('loading')
    setError(null)
    setTalentNotice(false)
    try {
      const { profile, hasTalents } = await fetchArmoryProfile({
        region,
        realm: realm.trim(),
        name: name.trim(),
      })
      setBase(profile)
      setTalentNotice(!hasTalents)
    } catch (err) {
      setError(
        err instanceof ArmoryError
          ? err.message
          : 'Something went wrong importing this character.',
      )
    } finally {
      setStatus('idle')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <h3 className="text-fg font-display text-sm font-semibold">
          Import from the Armory
        </h3>
        <p className="text-fg-muted text-sm">
          Fetch your public character directly from Blizzard — no addon paste
          needed.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            Region
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as ArmoryRegion)}
            className="bg-surface-inset border-border-subtle text-fg focus-visible:border-border rounded-md border px-3 py-2 text-sm outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            Realm
          </span>
          <input
            value={realm}
            onChange={(e) => setRealm(e.target.value)}
            placeholder="Area 52"
            spellCheck={false}
            className="bg-surface-inset border-border-subtle text-fg placeholder:text-fg-faint focus-visible:border-border rounded-md border px-3 py-2 text-sm outline-none"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-fg-faint text-xs font-semibold tracking-wide uppercase">
            Character
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            spellCheck={false}
            className="bg-surface-inset border-border-subtle text-fg placeholder:text-fg-faint focus-visible:border-border rounded-md border px-3 py-2 text-sm outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'loading' ? 'Importing…' : 'Import'}
        </button>
      </div>

      {error && <span className="text-danger text-sm">{error}</span>}
      {talentNotice && (
        <span className="text-fg-muted text-sm">
          Gear imported. Talents aren’t available from the Armory right now — paste
          your <code className="font-mono">/simc</code> string to include them.
        </span>
      )}
    </form>
  )
}
