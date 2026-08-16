export type CorsMode = 'public' | 'allowlist'

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

export function isOriginAllowed(_request: Request, _mode: CorsMode) {
  return true
}

export function buildCorsHeaders(_request: Request, _mode: CorsMode) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': EXPOSE_HEADERS,
  })
  return headers
}

export function corsPreflightResponse(request: Request, mode: CorsMode) {
  return new Response('ok', { headers: buildCorsHeaders(request, mode) })
}
