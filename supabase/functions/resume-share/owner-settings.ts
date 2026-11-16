import type { AdminClient, ShareJson } from './types.ts'
import type { createRequestContext } from '../shared/request-context.ts'
import type { readShareRequest } from './input.ts'
import { authenticateSupabaseUser } from '../shared/supabase-auth.ts'
import { verifyShareOwnership, consumeOwnerWriteLimit } from './repository.ts'
import { hashPassword } from './password.ts'
import { scheduleBackground } from '../shared/operation-metrics.ts'
import { notifyShareCommentSettings } from './notifications.ts'

export async function updateShareSettings({
  req,
  admin,
  supabaseUrl,
  serviceRoleKey,
  context,
  json,
  input,
}: {
  req: Request
  admin: AdminClient
  supabaseUrl: string
  serviceRoleKey: string
  context: ReturnType<typeof createRequestContext>
  json: ShareJson
  input: Awaited<ReturnType<typeof readShareRequest>>
}): Promise<Response> {
  const {
    shareId,
    label,
    password,
    expiresAt,
    settingsBody,
    passwordProvided,
    allowComments,
    operation,
  } = input

  const { userId } = await authenticateSupabaseUser({
    request: req,
    client: admin,
    supabaseUrl,
  })

  if (!userId) return json({ error: 'unauthorized' }, 401)
  if (!shareId) return json({ error: 'missing shareId' }, 400)
  if (label && label.length > 120) return json({ error: 'label_too_long' }, 400)
  if (password && password.length > 128)
    return json({ error: 'password_too_long' }, 400)
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime()))
    return json({ error: 'invalid_expiry' }, 400)
  if (
    settingsBody.activate !== undefined &&
    typeof settingsBody.activate !== 'boolean'
  )
    return json({ error: 'invalid_activation' }, 400)
  if (!(await verifyShareOwnership(admin, shareId, userId)))
    return json({ error: 'not_found' }, 404)
  if (!(await consumeOwnerWriteLimit(admin, userId)))
    return json({ error: 'rate_limited' }, 429)

  for (const key of ['showPhone', 'showEmail']) {
    if (
      settingsBody[key] !== undefined &&
      typeof settingsBody[key] !== 'boolean'
    )
      return json({ error: 'invalid_contact_policy' }, 400)
  }

  const patch: Record<string, unknown> = {
    ...(typeof settingsBody.showPhone === 'boolean'
      ? { show_phone: settingsBody.showPhone }
      : {}),
    ...(typeof settingsBody.showEmail === 'boolean'
      ? { show_email: settingsBody.showEmail }
      : {}),
    label,
    expires_at: expiresAt,
    ...(allowComments === undefined ? {} : { allow_comments: allowComments }),
    ...(settingsBody.activate === true ? { is_active: true } : {}),
  }

  if (passwordProvided) {
    try {
      patch.password_hash = password ? await hashPassword(password) : null
    } catch {
      context.log({
        level: 'error',
        event: 'password_hash_failed',
        operation,
        status: 500,
        errorCode: 'unexpected',
      })

      return json({ error: 'unexpected' }, 500)
    }
  }

  const { data: savedShare, error } = await admin
    .from('resume_shares')
    .update(patch)
    .eq('id', shareId)
    .eq('user_id', userId)
    .select('current_release_id,version_id,allow_comments')
    .maybeSingle()

  if (error) {
    context.log({
      level: 'error',
      event: 'database_write_failed',
      operation,
      status: 500,
      errorCode: 'database_unexpected',
      sqlState: error.code,
    })

    return json({ error: 'unexpected' }, 500)
  }
  if (!savedShare) return json({ error: 'not_found' }, 404)
  if (allowComments !== undefined) {
    const realtimeSecret =
      Deno.env.get('RESUME_COMMENT_REALTIME_SECRET') ??
      Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ??
      serviceRoleKey

    scheduleBackground(
      notifyShareCommentSettings({
        admin,
        share: savedShare,
        userId,
        realtimeSecret,
      }).catch(() => {
        context.log({
          level: 'warn',
          event: 'comment_notification_failed',
          operation,
          status: 200,
          errorCode: 'database_unexpected',
        })
      }),
    )
  }

  return json({ ok: true })
}
