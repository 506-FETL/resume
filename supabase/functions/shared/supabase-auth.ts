export type SupabaseAuthMode = 'anonymous' | 'local_jwks' | 'legacy_auth'

export interface SupabaseAuthIdentity {
  userId: string | null
  authMode: SupabaseAuthMode
}

interface SupabaseClaimsResult {
  data: {
    claims: Record<string, unknown>
    header: { alg?: unknown }
  } | null
  error: unknown
}

export interface SupabaseClaimsClient {
  auth: {
    getClaims: (jwt: string) => Promise<SupabaseClaimsResult>
  }
}

export class SupabaseAuthenticationError extends Error {
  readonly code = 'unauthorized'
  readonly status = 401

  constructor() {
    super('unauthorized')
    this.name = 'SupabaseAuthenticationError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function unauthorized(): never {
  throw new SupabaseAuthenticationError()
}

export async function authenticateSupabaseUser(params: {
  request: Request
  client: SupabaseClaimsClient
  supabaseUrl: string
}): Promise<SupabaseAuthIdentity> {
  const authorization = params.request.headers.get('Authorization')?.trim()
  if (!authorization || !/^Bearer(?:\s|$)/iu.test(authorization)) {
    return { userId: null, authMode: 'anonymous' }
  }

  const jwt = authorization.slice('Bearer'.length).trim()
  if (!jwt)
    return unauthorized()

  const apikey = params.request.headers.get('apikey')?.trim()
  if (jwt === apikey && jwt.startsWith('sb_publishable_')) {
    return { userId: null, authMode: 'anonymous' }
  }
  if (jwt.split('.').length !== 3 || jwt.split('.').some(part => !part))
    return unauthorized()

  let result: SupabaseClaimsResult
  try {
    result = await params.client.auth.getClaims(jwt)
  }
  catch {
    return unauthorized()
  }
  if (result.error || !result.data)
    return unauthorized()

  const { claims, header } = result.data
  const expectedIssuer = `${params.supabaseUrl.replace(/\/$/u, '')}/auth/v1`
  const hasAuthenticatedAudience = claims.aud === 'authenticated'
    || (Array.isArray(claims.aud) && claims.aud.includes('authenticated'))
  if (
    claims.iss !== expectedIssuer
    || !hasAuthenticatedAudience
    || !Number.isInteger(claims.exp)
    || (claims.exp as number) <= Math.floor(Date.now() / 1_000)
    || typeof claims.sub !== 'string'
    || !UUID_PATTERN.test(claims.sub)
    || claims.role !== 'authenticated'
    || typeof claims.session_id !== 'string'
    || !UUID_PATTERN.test(claims.session_id)
  ) {
    return unauthorized()
  }

  if (header.alg === 'HS256') {
    return { userId: claims.sub, authMode: 'legacy_auth' }
  }
  if (header.alg === 'ES256' || header.alg === 'RS256') {
    return { userId: claims.sub, authMode: 'local_jwks' }
  }
  return unauthorized()
}
