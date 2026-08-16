/* global Deno */

export type CorsMode = 'public' | 'allowlist'

const DEFAULT_APP_ORIGINS = ['https://506resume.vercel.app']
const ALLOW_HEADERS = 'authorization, x-client-info, x-request-id, apikey, content-type'
const EXPOSE_HEADERS = [
  'Server-Timing',
  'X-Request-Id',
  'X-Sb-Edge-Region',
  'X-Comment-Auth-Mode',
  'X-Comment-Scope-Repair',
  'X-AI-Quota-Remaining',
  'X-AI-Quota-Daily-Limit',
  'X-AI-Quota-Reset-At',
  'X-AI-Quota-Unlimited',
].join(', ')

function configuredOrigins() {
  const configured = Deno.env.get('APP_ALLOWED_ORIGINS')
    ?.split(',')
    .map(value => value.trim())
    .filter(Boolean) ?? []
  return new Set([...DEFAULT_APP_ORIGINS, ...configured])
}

export function isOriginAllowed(request: Request, mode: CorsMode) {
  if (mode === 'public')
    return true
  const origin = request.headers.get('Origin')
  return !origin || configuredOrigins().has(origin)
}

export function buildCorsHeaders(request: Request, mode: CorsMode) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': EXPOSE_HEADERS,
  })
  if (mode === 'public') {
    headers.set('Access-Control-Allow-Origin', '*')
    return headers
  }

  headers.set('Vary', 'Origin')
  const origin = request.headers.get('Origin')
  if (origin && configuredOrigins().has(origin))
    headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export function corsPreflightResponse(request: Request, mode: CorsMode) {
  if (!isOriginAllowed(request, mode)) {
    return new Response(JSON.stringify({ error: 'origin_forbidden' }), {
      status: 403,
      headers: {
        ...Object.fromEntries(buildCorsHeaders(request, mode)),
        'Content-Type': 'application/json',
      },
    })
  }
  return new Response('ok', { headers: buildCorsHeaders(request, mode) })
}
