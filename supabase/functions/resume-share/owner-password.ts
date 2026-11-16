import type { AdminClient, ShareJson } from './types.ts'
import type { createRequestContext } from '../shared/request-context.ts'
import type { readShareRequest } from './input.ts'
import { authenticateSupabaseUser } from '../shared/supabase-auth.ts'
import { verifyShareOwnership, consumeOwnerWriteLimit } from './repository.ts'
import { hashPassword } from './password.ts'

export async function setSharePassword({
  req,
  admin,
  supabaseUrl,
  context,
  json,
  input,
}: {
  req: Request
  admin: AdminClient
  supabaseUrl: string
  context: ReturnType<typeof createRequestContext>
  json: ShareJson
  input: Awaited<ReturnType<typeof readShareRequest>>
}): Promise<Response> {
  const { shareId, password, operation } = input

  const { userId } = await authenticateSupabaseUser({
    request: req,
    client: admin,
    supabaseUrl,
  })

  if (!userId) return json({ error: 'unauthorized' }, 401)
  if (!shareId) return json({ error: 'missing shareId' }, 400)
  if (password && password.length > 128)
    return json({ error: 'password_too_long' }, 400)
  if (!(await verifyShareOwnership(admin, shareId, userId)))
    return json({ error: 'not_found' }, 404)
  if (!(await consumeOwnerWriteLimit(admin, userId)))
    return json({ error: 'rate_limited' }, 429)

  let nextHash: string | null = null

  try {
    nextHash = password ? await hashPassword(password) : null
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

  const { error, count } = await admin
    .from('resume_shares')
    .update({ password_hash: nextHash }, { count: 'exact' })
    .eq('id', shareId)
    .eq('user_id', userId)

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
  if (!count) return json({ error: 'not_found' }, 404)

  return json({ ok: true })
}
