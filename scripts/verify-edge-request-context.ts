import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const environment = new Map<string, string>([
  ['APP_ALLOWED_ORIGINS', 'http://localhost:5173, https://staging.example.com'],
  ['SB_REGION', 'us-east-1'],
])

Object.assign(globalThis, {
  Deno: {
    env: {
      get(name: string) {
        return environment.get(name)
      },
    },
  },
})

const {
  buildCorsHeaders,
  corsPreflightResponse,
  isOriginAllowed,
} = await import('../supabase/functions/shared/cors.ts')
const {
  createRequestContext,
  readOrCreateRequestId,
} = await import('../supabase/functions/shared/request-context.ts')

const endpoint = 'https://edge.test/functions/v1/test'
const validRequestId = '00000000-0000-4000-8000-000000000001'
function request(origin?: string, requestId?: string, method = 'POST') {
  const headers = new Headers()
  if (origin)
    headers.set('Origin', origin)
  if (requestId)
    headers.set('X-Request-Id', requestId)
  return new Request(endpoint, { method, headers })
}

assert.equal(readOrCreateRequestId(request(undefined, validRequestId)), validRequestId)
assert.match(
  readOrCreateRequestId(request(undefined, 'not-a-request-id')),
  /^[0-9a-f-]{36}$/u,
)
assert.notEqual(
  readOrCreateRequestId(request(undefined, 'not-a-request-id')),
  readOrCreateRequestId(request(undefined, 'not-a-request-id')),
)

const productionOrigin = 'https://506resume.vercel.app'
const localOrigin = 'http://localhost:5173'
const rejectedOrigin = 'https://506resume.vercel.app.attacker.example'

for (const origin of [productionOrigin, localOrigin, 'https://staging.example.com']) {
  const allowedRequest = request(origin)
  assert.equal(isOriginAllowed(allowedRequest, 'allowlist'), true)
  assert.equal(
    buildCorsHeaders(allowedRequest, 'allowlist').get('Access-Control-Allow-Origin'),
    origin,
  )
}

const rejectedRequest = request(rejectedOrigin)
assert.equal(isOriginAllowed(rejectedRequest, 'allowlist'), false)
assert.equal(
  buildCorsHeaders(rejectedRequest, 'allowlist').has('Access-Control-Allow-Origin'),
  false,
)
assert.equal(corsPreflightResponse(rejectedRequest, 'allowlist').status, 403)

const serverRequest = request()
assert.equal(isOriginAllowed(serverRequest, 'allowlist'), true)
assert.equal(
  buildCorsHeaders(serverRequest, 'allowlist').has('Access-Control-Allow-Origin'),
  false,
)

const publicHeaders = buildCorsHeaders(rejectedRequest, 'public')
assert.equal(publicHeaders.get('Access-Control-Allow-Origin'), '*')
assert.match(publicHeaders.get('Access-Control-Expose-Headers') ?? '', /X-Request-Id/u)
assert.match(publicHeaders.get('Access-Control-Expose-Headers') ?? '', /X-AI-Quota-Remaining/u)

const context = createRequestContext(
  request(productionOrigin, validRequestId),
  'test-function',
  'allowlist',
)
const contextResponse = context.json({ ok: true })
assert.equal(context.requestId, validRequestId)
assert.equal(contextResponse.headers.get('X-Request-Id'), validRequestId)
assert.equal(contextResponse.headers.get('X-Sb-Edge-Region'), 'us-east-1')
assert.equal(contextResponse.headers.get('Access-Control-Allow-Origin'), productionOrigin)
assert.equal(contextResponse.headers.get('Cache-Control'), 'no-store')

function source(path: string) {
  return readFileSync(path, 'utf8')
}
const llmSource = source('supabase/functions/llm-proxy/index.ts')
const shareSource = source('supabase/functions/resume-share/index.ts')
const commentsSource = source('supabase/functions/resume-comments/index.ts')

assert.ok(llmSource.indexOf('admin.rpc(\'reserve_ai_credits\'') < llmSource.indexOf('await fetch(DEEPSEEK_URL'))
assert.match(llmSource, /stream_options = \{ include_usage: true \}/u)
assert.doesNotMatch(llmSource, /admin\.rpc\('check_ai_quota'/u)
assert.doesNotMatch(llmSource, /admin\.rpc\('consume_ai_credits'/u)
assert.match(shareSource, /createRequestContext\(req, 'resume-share', 'public'\)/u)
assert.match(commentsSource, /createRequestContext\(req, 'resume-comments', 'allowlist'\)/u)
assert.doesNotMatch(
  [llmSource, shareSource, commentsSource].join('\n'),
  /console\.(?:log|warn|error)\([^)]*(?:authorization|apikey|password|userId|shareId|message)/iu,
)

console.warn('Edge request context and CORS verification passed')
