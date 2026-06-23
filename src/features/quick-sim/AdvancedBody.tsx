import { SimcEditor } from '@/features/advanced/SimcEditor'
import { useQuickSim } from './store'
import sampleProfile from '@/engine/fixtures/sample-profile.simc?raw'

/**
 * Advanced sub-tab body (WEB_UI_PLAN U4): a raw `.simc` editor over the SAME
 * engine path + run-state store as Compose. No auto-inspect preview — the editor
 * runs the profile directly via the context bar / the inline Run button.
 */
export function AdvancedBody() {
  const { profile, setProfile, run, error } = useQuickSim()

  return (
    <div className="flex flex-col gap-4">
      <SimcEditor value={profile} onChange={setProfile} />
      {error && (
        <pre className="text-danger font-mono text-xs whitespace-pre-wrap">
          {error}
        </pre>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!profile.trim()}
          className="bg-accent text-accent-fg hover:bg-accent-hover rounded-md px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run simulation
        </button>
        <button
          type="button"
          onClick={() => setProfile(sampleProfile)}
          className="text-fg-faint hover:text-fg-muted text-xs underline"
        >
          Load example
        </button>
      </div>
    </div>
  )
}
