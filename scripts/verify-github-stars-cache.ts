import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  APP_GITHUB_API_URL,
  APP_GITHUB_REPOSITORY_KEY,
  buildGithubFailureUpdate,
  classifyGithubStatus,
  normalizeGithubEtag,
  readGithubStars,
} from '../supabase/functions/github-stars-refresh/core.ts'

const migration = readFileSync(
  'supabase/migrations/20260816084543_move_github_stars_to_edge_cache.sql',
  'utf8',
)
const edge = readFileSync('supabase/functions/github-stars-refresh/index.ts', 'utf8')
const client = readFileSync('src/lib/supabase/github-stars.ts', 'utf8')
const component = readFileSync(
  'src/components/animate-ui/primitives/animate/github-stars.tsx',
  'utf8',
)
const config = readFileSync('supabase/config.toml', 'utf8')

assert.equal(APP_GITHUB_REPOSITORY_KEY, '506-fetl/resume')
assert.equal(APP_GITHUB_API_URL, 'https://api.github.com/repos/506-FETL/resume')

assert.equal(readGithubStars({ stargazers_count: 123 }), 123)
for (const invalid of [
  null,
  {},
  { stargazers_count: -1 },
  { stargazers_count: 1.5 },
  { stargazers_count: '123' },
  { stargazers_count: Number.MAX_SAFE_INTEGER + 1 },
]) {
  assert.equal(readGithubStars(invalid), null)
}
assert.equal(normalizeGithubEtag('  "etag"  '), '"etag"')
assert.equal(normalizeGithubEtag(''), null)
assert.equal(normalizeGithubEtag('x'.repeat(257)), null)
assert.equal(classifyGithubStatus(403), 'github_rate_limited')
assert.equal(classifyGithubStatus(429), 'github_rate_limited')
assert.equal(classifyGithubStatus(500), 'github_upstream_error')
assert.equal(classifyGithubStatus(404), 'github_unexpected_status')
assert.deepEqual(
  buildGithubFailureUpdate(2, 'github_timeout', '2026-08-16T00:00:00.000Z'),
  {
    last_attempt_at: '2026-08-16T00:00:00.000Z',
    last_error_at: '2026-08-16T00:00:00.000Z',
    last_error_code: 'github_timeout',
    consecutive_failures: 3,
  },
)

assert.match(migration, /CHECK \(repo = '506-fetl\/resume'\)/u)
assert.match(migration, /GRANT SELECT ON TABLE public\.github_stars TO anon, authenticated/u)
assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO (?:anon|authenticated)/u)
assert.match(migration, /DROP FUNCTION IF EXISTS public\.get_github_stars\(text, text\)/u)
assert.match(migration, /DROP FUNCTION IF EXISTS public\.set_github_stars\(text, text, integer\)/u)
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_app_github_stars\(\)/u)
assert.match(migration, /SECURITY INVOKER/u)
assert.match(migration, /DROP EXTENSION IF EXISTS http;/u)
assert.doesNotMatch(migration, /DROP EXTENSION[^;]*CASCADE/iu)

assert.match(edge, /request\.method !== 'POST'/u)
assert.match(edge, /BACKEND_MAINTENANCE_TOKEN/u)
assert.match(edge, /constantTimeEqual\(suppliedToken, maintenanceToken\)/u)
assert.match(edge, /const rawBody = await request\.text\(\)/u)
assert.match(edge, /JSON\.parse\(rawBody\)/u)
assert.match(edge, /Object\.keys\(body\)\.length > 0/u)
assert.match(edge, /AbortSignal\.timeout\(5_000\)/u)
assert.match(edge, /headers\.set\('If-None-Match', current\.etag\)/u)
assert.match(edge, /if \(upstream\.status === 304\)/u)
assert.match(edge, /if \(upstream\.status !== 200\)/u)
assert.doesNotMatch(edge, /body(?:\.|\[['"])(?:owner|repo|stars)/iu)
assert.ok(edge.indexOf('recordFailure(admin, current') < edge.indexOf('{ error: errorCode }'))

assert.match(client, /supabase\.rpc\('get_app_github_stars'\)/u)
assert.match(client, /Promise<GithubStars \| null>/u)
assert.doesNotMatch(client, /p_owner|p_repo|get_github_stars|set_github_stars/u)
assert.doesNotMatch(component, /api\.github\.com|fetch\(/u)
assert.doesNotMatch(component, /username\??:|repo\??:/u)
assert.match(config, /\[functions\.github-stars-refresh\]\s+verify_jwt = false/u)

console.warn('GitHub stars Edge cache verification passed')
