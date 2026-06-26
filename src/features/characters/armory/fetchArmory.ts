/**
 * Client call to the same-origin `/api/armory` Pages Function, then the pure
 * transform. Keeps the network + validation concern out of the form component.
 */
import {
  ArmoryPayloadSchema,
  toSimcProfile,
  type SimcProfileResult,
} from './toSimcProfile'

export type ArmoryRegion = 'us' | 'eu' | 'kr' | 'tw'

export interface ArmoryRequest {
  region: ArmoryRegion
  realm: string
  name: string
}

/** Thrown with a user-facing message + the HTTP status the Function returned. */
export class ArmoryError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ArmoryError'
    this.status = status
  }
}

/**
 * Fetch a character from the Armory and return the built simc profile. Errors are
 * surfaced as `ArmoryError` with the Function's status (404/429/400/500/502) so the
 * form can show the right message without branching on transport details.
 */
export async function fetchArmoryProfile({
  region,
  realm,
  name,
}: ArmoryRequest): Promise<SimcProfileResult> {
  const params = new URLSearchParams({ region, realm, name })
  let res: Response
  try {
    res = await fetch(`/api/armory?${params.toString()}`)
  } catch {
    throw new ArmoryError('Could not reach the Armory service.', 0)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new ArmoryError('The Armory service returned an unreadable response.', res.status)
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : '') || `Armory request failed (${res.status}).`
    throw new ArmoryError(message, res.status)
  }

  const parsed = ArmoryPayloadSchema.safeParse(body)
  if (!parsed.success) {
    throw new ArmoryError(
      'The Armory returned data this app could not understand.',
      res.status,
    )
  }
  return toSimcProfile(parsed.data)
}
