/**
 * Cloudflare Pages Function — Armory import auth proxy + relay.
 *
 * Served at `/api/armory` (same origin as the app via Pages file routing). It does
 * exactly two things and NOTHING else:
 *   1. Mints a Blizzard app token (client_credentials) using server-only secrets.
 *   2. Relays three PUBLIC character-profile endpoints back to the client as one
 *      lean JSON payload.
 *
 * The simc string is built CLIENT-SIDE (see src/features/characters/armory/
 * toSimcProfile.ts) — this Function never assembles a profile and never touches
 * the SimEngine seam. The Blizzard secrets (BLIZZARD_CLIENT_ID/SECRET) are read
 * only from `env` here and MUST NOT be exposed to the client bundle (no VITE_
 * prefix). The token is never echoed in any response or log.
 *
 * This file is a separate runtime (Workers), deliberately NOT part of the app's
 * tsconfig/Vite graph: it imports no app modules and defines its own minimal types,
 * so the app typecheck/build never sees it.
 */

interface Env {
  BLIZZARD_CLIENT_ID?: string
  BLIZZARD_CLIENT_SECRET?: string
}

/** Minimal Pages Functions context shape (avoids depending on @cloudflare/* types). */
interface PagesContext {
  request: Request
  env: Env
}

const REGIONS = ['us', 'eu', 'kr', 'tw'] as const
type Region = (typeof REGIONS)[number]

const OAUTH_HOST = 'https://oauth.battle.net/token'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Realm slug as Blizzard expects it in the URL: lowercase, spaces/underscores → `-`,
 * apostrophes dropped, accents stripped, non-alnum-dash removed. A safety net — the
 * client should already send something close, but the API is strict.
 */
function slugifyRealm(realm: string): string {
  return realm
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/['']/g, '') // drop apostrophes
    .replace(/[\s_]+/g, '-') // spaces/underscores → dash
    .replace(/[^a-z0-9-]/g, '') // anything else
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Base64 of `id:secret` for HTTP Basic, without leaking either part. */
function basicAuth(id: string, secret: string): string {
  return btoa(`${id}:${secret}`)
}

interface CachedToken {
  token: string
  /** epoch ms when this token should be considered expired. */
  expiresAt: number
}

// In-isolate token cache. A single Workers isolate handles many requests, so this
// avoids re-minting on every call within an isolate's lifetime. NOTE: this is NOT
// shared across isolates/edge locations — the Cloudflare Cache API would give a
// cross-isolate cache but adds real complexity (synthetic cache-key request,
// Response cloning) for a token that is cheap to mint. v1 keeps it simple; see the
// report. The 60s skew guard prevents handing out a token that's about to expire.
let tokenCache: CachedToken | null = null

async function getAppToken(env: Env): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token
  }
  const id = env.BLIZZARD_CLIENT_ID
  const secret = env.BLIZZARD_CLIENT_SECRET
  // Caller guarantees these are present, but guard anyway (no secret in the error).
  if (!id || !secret) throw new ConfigError()

  const res = await fetch(OAUTH_HOST, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basicAuth(id, secret)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    // Do not include the body — it can echo the (bad) credentials context.
    throw new UpstreamError(502, 'Could not authenticate with Blizzard')
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new UpstreamError(502, 'Blizzard returned no access token')
  }
  const ttlMs = (data.expires_in ?? 3600) * 1000
  tokenCache = { token: data.access_token, expiresAt: now + ttlMs }
  return data.access_token
}

/** Thrown when the server is missing Blizzard creds — surfaced as a clear 500. */
class ConfigError extends Error {}

/** Thrown to short-circuit with a specific HTTP status + client-safe message. */
class UpstreamError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function fetchProfile(
  region: Region,
  token: string,
  path: string,
): Promise<unknown> {
  const url =
    `https://${region}.api.blizzard.com/profile/wow/character/${path}` +
    `?namespace=profile-${region}&locale=en_US`
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (res.status === 404) {
    throw new UpstreamError(
      404,
      'Character not found (Armory only lists characters that have logged in recently)',
    )
  }
  if (res.status === 429) {
    throw new UpstreamError(429, 'Blizzard rate-limited, try again shortly')
  }
  if (!res.ok) {
    throw new UpstreamError(502, `Blizzard request failed (${res.status})`)
  }
  return res.json()
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context

  // Fail loud + obvious in local dev when creds aren't wired (no .dev.vars).
  if (!env.BLIZZARD_CLIENT_ID || !env.BLIZZARD_CLIENT_SECRET) {
    return json(
      {
        error:
          'Armory import is not configured on the server (missing Blizzard API credentials).',
      },
      500,
    )
  }

  const { searchParams } = new URL(request.url)
  const regionRaw = (searchParams.get('region') ?? '').toLowerCase()
  const realmRaw = searchParams.get('realm') ?? ''
  const nameRaw = searchParams.get('name') ?? ''

  if (!REGIONS.includes(regionRaw as Region)) {
    return json({ error: `Invalid region (expected one of ${REGIONS.join(', ')}).` }, 400)
  }
  const region = regionRaw as Region
  const realm = slugifyRealm(realmRaw)
  const name = nameRaw.trim().toLowerCase()
  if (!realm) return json({ error: 'Missing or invalid realm.' }, 400)
  if (!name) return json({ error: 'Missing character name.' }, 400)
  // Blizzard names are URL-path segments; encode to be safe.
  const path = `${encodeURIComponent(realm)}/${encodeURIComponent(name)}`

  try {
    const token = await getAppToken(env)
    const [summary, equipment, specializations] = await Promise.all([
      fetchProfile(region, token, path),
      fetchProfile(region, token, `${path}/equipment`),
      fetchProfile(region, token, `${path}/specializations`),
    ])
    return json({ region, summary, equipment, specializations })
  } catch (err) {
    if (err instanceof ConfigError) {
      return json(
        {
          error:
            'Armory import is not configured on the server (missing Blizzard API credentials).',
        },
        500,
      )
    }
    if (err instanceof UpstreamError) {
      return json({ error: err.message }, err.status)
    }
    // Never leak internals/creds.
    return json({ error: 'Unexpected error contacting the Armory.' }, 502)
  }
}
