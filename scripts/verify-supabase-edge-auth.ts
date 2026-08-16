import type { SupabaseClaimsClient } from '../supabase/functions/shared/supabase-auth.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../supabase/functions/shared/supabase-auth.ts'

const supabaseUrl = 'https://resume-auth-test.supabase.co'
const userId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const jwt = 'header.payload.signature'

function request(authorization?: string, apikey?: string) {
  const headers = new Headers()
  if (authorization)
    headers.set('Authorization', authorization)
  if (apikey)
    headers.set('apikey', apikey)
  return new Request('https://edge.test/functions/v1/test', { headers })
}

function validClaims() {
  return {
    iss: `${supabaseUrl}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1_000) + 3_600,
    sub: userId,
    role: 'authenticated',
    session_id: sessionId,
  }
}

function claimsClient(options: {
  claims?: Record<string, unknown>
  alg?: unknown
  error?: boolean
  shouldNotCall?: boolean
  shouldThrow?: boolean
} = {}): SupabaseClaimsClient {
  return {
    auth: {
      async getClaims() {
        if (options.shouldNotCall)
          assert.fail('anonymous authentication must not call getClaims')
        if (options.shouldThrow)
          throw new Error('getClaims failed')
        if (options.error)
          return { data: null, error: new Error('invalid token') }
        return {
          data: {
            claims: options.claims ?? validClaims(),
            header: { alg: options.alg ?? 'ES256' },
          },
          error: null,
        }
      },
    },
  }
}

function authenticate(options: {
  claims?: Record<string, unknown>
  alg?: unknown
  error?: boolean
  shouldThrow?: boolean
} = {}) {
  return authenticateSupabaseUser({
    request: request(`Bearer ${jwt}`),
    client: claimsClient(options),
    supabaseUrl,
  })
}

await assert.doesNotReject(() => authenticateSupabaseUser({
  request: request(),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}))
assert.deepEqual(await authenticateSupabaseUser({
  request: request('Basic credentials'),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}), { userId: null, authMode: 'anonymous' })
await assert.rejects(() => authenticateSupabaseUser({
  request: request('Bearer'),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}), SupabaseAuthenticationError)

const publishableKey = 'sb_publishable_not-a-three-part-jwt'
assert.deepEqual(await authenticateSupabaseUser({
  request: request(`Bearer ${publishableKey}`, publishableKey),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}), { userId: null, authMode: 'anonymous' })

await assert.rejects(() => authenticateSupabaseUser({
  request: request('Bearer malformed', 'sb_publishable_different'),
  client: claimsClient({ shouldNotCall: true }),
  supabaseUrl,
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({ error: true }), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({ shouldThrow: true }), SupabaseAuthenticationError)

assert.equal((await authenticate({ alg: 'HS256' })).authMode, 'legacy_auth')
assert.equal((await authenticate({ alg: 'ES256' })).authMode, 'local_jwks')
assert.equal((await authenticate({ alg: 'RS256' })).authMode, 'local_jwks')
await assert.rejects(() => authenticate({ alg: 'EdDSA' }), SupabaseAuthenticationError)

const invalidIssuer = {
  ...validClaims(),
  iss: 'https://attacker.example/auth/v1',
}
await assert.rejects(() => authenticate({ claims: invalidIssuer }), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), aud: ['service_role', 'anon'] },
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), exp: Math.floor(Date.now() / 1_000) - 1 },
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), exp: Math.floor(Date.now() / 1_000) + 0.5 },
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), sub: 'not-a-uuid' },
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), role: 'service_role' },
}), SupabaseAuthenticationError)
await assert.rejects(() => authenticate({
  claims: { ...validClaims(), session_id: 'not-a-uuid' },
}), SupabaseAuthenticationError)

assert.deepEqual(await authenticate({
  claims: { ...validClaims(), aud: ['anon', 'authenticated'] },
}), { userId, authMode: 'local_jwks' })

const functionSources = [
  'supabase/functions/resume-comments/index.ts',
  'supabase/functions/resume-share/index.ts',
  'supabase/functions/llm-proxy/index.ts',
].map(path => readFileSync(path, 'utf8'))
for (const source of functionSources) {
  assert.match(source, /@supabase\/supabase-js@2\.103\.0/u)
  assert.doesNotMatch(source, /@supabase\/supabase-js@2['"]/u)
  assert.doesNotMatch(source, /\.auth\.getUser\(/u)
}

const shareSource = functionSources[1]
const anonymousShareBranch = shareSource.indexOf('// ============ 匿名读取分支')
assert.notEqual(anonymousShareBranch, -1)
assert.doesNotMatch(shareSource.slice(anonymousShareBranch), /authenticateSupabaseUser\(/u)

const llmSource = functionSources[2]
const llmAuthIndex = llmSource.indexOf('await authenticateSupabaseUser')
assert.ok(llmAuthIndex >= 0)
assert.ok(llmAuthIndex < llmSource.indexOf('await request.text()'))
assert.doesNotMatch(llmSource, /admin\.rpc\('check_ai_quota'/u)
assert.doesNotMatch(llmSource, /admin\.rpc\('consume_ai_credits'/u)
assert.ok(llmAuthIndex < llmSource.indexOf('admin.rpc(\'reserve_ai_credits\''))
assert.ok(llmAuthIndex < llmSource.indexOf('await fetch(DEEPSEEK_URL'))

const configSource = readFileSync('supabase/config.toml', 'utf8')
for (const functionName of ['resume-share', 'resume-comments', 'llm-proxy']) {
  assert.match(
    configSource,
    new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = false`, 'u'),
  )
}

console.warn('Supabase Edge authentication verification passed')
