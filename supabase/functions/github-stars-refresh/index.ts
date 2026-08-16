/* global Deno */

import type { GithubRefreshErrorCode } from './core.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { corsPreflightResponse, isOriginAllowed } from '../shared/cors.ts'
import { hasValidMaintenanceToken } from '../shared/maintenance-auth.ts'
import { recordOperationMetric, scheduleBackground } from '../shared/operation-metrics.ts'
import { createRequestContext } from '../shared/request-context.ts'
import {
  APP_GITHUB_API_URL,
  APP_GITHUB_REPOSITORY_KEY,
  buildGithubFailureUpdate,
  classifyGithubStatus,
  normalizeGithubEtag,
  readGithubStars,
} from './core.ts'

interface GithubCacheRow {
  repo: string
  stars: number
  fetched_at: string
  etag: string | null
  consecutive_failures: number
}

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type AdminClient = ReturnType<typeof createAdminClient>

async function recordFailure(
  admin: AdminClient,
  current: GithubCacheRow | null,
  errorCode: GithubRefreshErrorCode,
) {
  if (!current)
    return
  const attemptedAt = new Date().toISOString()
  const { error } = await admin
    .from('github_stars')
    .update(buildGithubFailureUpdate(current.consecutive_failures, errorCode, attemptedAt))
    .eq('repo', APP_GITHUB_REPOSITORY_KEY)
  if (error)
    throw new Error('github cache failure state write failed')
}

Deno.serve(async (request) => {
  const context = createRequestContext(request, 'github-stars-refresh', 'allowlist')
  let admin: AdminClient | null = null

  const respond = (
    body: unknown,
    status: number,
    outcome: 'success' | 'client_error' | 'server_error',
    errorCode?: string,
  ) => {
    context.log({
      level: outcome === 'success' ? 'info' : outcome === 'client_error' ? 'warn' : 'error',
      event: outcome === 'success' ? 'request_completed' : 'request_failed',
      operation: 'refresh',
      status,
      errorCode,
    })
    if (admin) {
      scheduleBackground(recordOperationMetric(admin, {
        requestId: context.requestId,
        functionName: 'github-stars-refresh',
        operation: 'refresh',
        outcome,
        errorCode,
        status,
        durationMs: context.durationMs(),
      }))
    }
    return context.json(body, status)
  }

  if (request.method === 'OPTIONS')
    return corsPreflightResponse(request, 'allowlist')
  if (!isOriginAllowed(request, 'allowlist'))
    return respond({ error: 'origin_forbidden' }, 403, 'client_error', 'origin_forbidden')
  if (request.method !== 'POST')
    return respond({ error: 'not_found' }, 404, 'client_error', 'not_found')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const maintenanceToken = Deno.env.get('BACKEND_MAINTENANCE_TOKEN')
  if (
    !supabaseUrl
    || !serviceRoleKey
    || !maintenanceToken
    || maintenanceToken.length < 32
  ) {
    return respond(
      { error: 'service_not_configured' },
      500,
      'server_error',
      'service_not_configured',
    )
  }

  if (!hasValidMaintenanceToken(request, maintenanceToken))
    return respond({ error: 'unauthorized' }, 401, 'client_error', 'unauthorized')

  const rawBody = await request.text()
  let body: unknown = {}
  try {
    body = rawBody.trim() ? JSON.parse(rawBody) : {}
  }
  catch {
    return respond({ error: 'unsupported_payload' }, 400, 'client_error', 'unsupported_payload')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0) {
    return respond({ error: 'unsupported_payload' }, 400, 'client_error', 'unsupported_payload')
  }

  admin = createAdminClient(supabaseUrl, serviceRoleKey)
  const { data: currentValue, error: readError } = await admin
    .from('github_stars')
    .select('repo,stars,fetched_at,etag,consecutive_failures')
    .eq('repo', APP_GITHUB_REPOSITORY_KEY)
    .maybeSingle()
  if (readError)
    return respond({ error: 'github_cache_read_failed' }, 503, 'server_error', 'github_cache_read_failed')
  const current = currentValue as GithubCacheRow | null

  const headers = new Headers({
    'Accept': 'application/vnd.github+json',
    'User-Agent': '506-resume-stars-refresh',
    'X-GitHub-Api-Version': '2022-11-28',
  })
  if (current?.etag)
    headers.set('If-None-Match', current.etag)
  const githubToken = Deno.env.get('GITHUB_TOKEN')?.trim()
  if (githubToken)
    headers.set('Authorization', `Bearer ${githubToken}`)

  let upstream: Response
  try {
    upstream = await fetch(APP_GITHUB_API_URL, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5_000),
    })
  }
  catch (error) {
    const errorCode = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'github_timeout'
      : 'github_upstream_error'
    try {
      await recordFailure(admin, current, errorCode)
    }
    catch {
      return respond({ error: 'github_cache_write_failed' }, 503, 'server_error', 'github_cache_write_failed')
    }
    return respond({ error: errorCode }, 503, 'server_error', errorCode)
  }

  const attemptedAt = new Date().toISOString()
  if (upstream.status === 304) {
    if (!current) {
      return respond(
        { error: 'github_unexpected_status' },
        502,
        'server_error',
        'github_unexpected_status',
      )
    }
    const { error } = await admin
      .from('github_stars')
      .update({
        fetched_at: attemptedAt,
        last_attempt_at: attemptedAt,
        consecutive_failures: 0,
        last_error_at: null,
        last_error_code: null,
      })
      .eq('repo', APP_GITHUB_REPOSITORY_KEY)
    if (error)
      return respond({ error: 'github_cache_write_failed' }, 503, 'server_error', 'github_cache_write_failed')
    return respond({ ok: true, status: 'not_modified' }, 200, 'success')
  }

  if (upstream.status !== 200) {
    const errorCode = classifyGithubStatus(upstream.status)
    try {
      await recordFailure(admin, current, errorCode)
    }
    catch {
      return respond({ error: 'github_cache_write_failed' }, 503, 'server_error', 'github_cache_write_failed')
    }
    return respond({ error: errorCode }, 503, 'server_error', errorCode)
  }

  const payload = await upstream.json().catch(() => null)
  const stars = readGithubStars(payload)
  if (stars === null) {
    try {
      await recordFailure(admin, current, 'github_invalid_response')
    }
    catch {
      return respond({ error: 'github_cache_write_failed' }, 503, 'server_error', 'github_cache_write_failed')
    }
    return respond(
      { error: 'github_invalid_response' },
      502,
      'server_error',
      'github_invalid_response',
    )
  }

  const { error: writeError } = await admin
    .from('github_stars')
    .upsert({
      repo: APP_GITHUB_REPOSITORY_KEY,
      stars,
      fetched_at: attemptedAt,
      etag: normalizeGithubEtag(upstream.headers.get('etag')),
      last_attempt_at: attemptedAt,
      consecutive_failures: 0,
      last_error_at: null,
      last_error_code: null,
    }, { onConflict: 'repo' })
  if (writeError)
    return respond({ error: 'github_cache_write_failed' }, 503, 'server_error', 'github_cache_write_failed')

  return respond({ ok: true, status: 'updated', stars }, 200, 'success')
})
