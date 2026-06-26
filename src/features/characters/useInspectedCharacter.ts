/**
 * Inspect a `.simc` profile into a `ParsedCharacter` for read-only display (the
 * Characters detail view, §7.2). Same engine seam the compose preview uses, but
 * packaged as a hook: re-inspects when `profile` changes, with a generation guard
 * so a stale result can't clobber a newer one. Cheap (a minimal-iteration run).
 */
import { useEffect, useState } from 'react'
import { getEngine, type ParsedCharacter } from '@/engine'
import { looksLikeProfile } from '@/lib/simcProfile'
import { useSimOptions } from '@/features/sim-options/simOptionsStore'

export type InspectStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useInspectedCharacter(profile: string): {
  character: ParsedCharacter | null
  status: InspectStatus
  error: string | null
} {
  const [character, setCharacter] = useState<ParsedCharacter | null>(null)
  const [status, setStatus] = useState<InspectStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!looksLikeProfile(profile)) {
      setCharacter(null)
      setStatus('idle')
      setError(null)
      return
    }
    let alive = true
    setStatus('loading')
    setError(null)
    getEngine()
      .inspect({ profile, options: useSimOptions.getState().options })
      .then(
        (c) => {
          if (!alive) return
          setCharacter(c)
          setStatus('ready')
        },
        (e: unknown) => {
          if (!alive) return
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        },
      )
    return () => {
      alive = false
    }
  }, [profile])

  return { character, status, error }
}
