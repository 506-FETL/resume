import type { RecoveryIdentity } from './types'
import { createClient } from '@supabase/supabase-js'
import supabase from '@/lib/supabase/client'
import { INVALID_RECOVERY_MESSAGE } from './const'

export function validateRecoveryPassword(
  password: string,
  confirmation: string,
) {
  if (!password) return '请输入新密码'
  if (password.length < 6) return '新密码至少需要 6 个字符'
  if (password !== confirmation) return '两次输入的新密码不一致'
  return null
}

export async function verifyRecoveryIdentity(): Promise<RecoveryIdentity> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error || !session) throw new Error(INVALID_RECOVERY_MESSAGE)
  const { data, error: claimsError } = await supabase.auth.getClaims(
    session.access_token,
  )
  const claims = data?.claims
  if (
    claimsError ||
    !claims ||
    claims.sub !== session.user.id ||
    typeof claims.session_id !== 'string' ||
    !claims.amr?.some(
      (method) => typeof method !== 'string' && method.method === 'recovery',
    )
  ) {
    throw new Error(INVALID_RECOVERY_MESSAGE)
  }
  const { data: latest, error: latestError } = await supabase.auth.getSession()
  if (latestError || latest.session?.access_token !== session.access_token)
    throw new Error(INVALID_RECOVERY_MESSAGE)
  return { userId: claims.sub, sessionId: claims.session_id, session }
}

export function isSameRecovery(
  left: RecoveryIdentity,
  right: RecoveryIdentity,
) {
  return left.userId === right.userId && left.sessionId === right.sessionId
}

export async function updateRecoveryPassword(
  identity: RecoveryIdentity,
  password: string,
) {
  // A private, non-persistent client binds the mutation to the verified recovery
  // tokens even if another tab signs in as a different user during this request.
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'password-recovery-submit',
      },
    },
  )
  try {
    const { data, error } = await client.auth.setSession(identity.session)
    if (error || data.user?.id !== identity.userId)
      throw new Error(INVALID_RECOVERY_MESSAGE)
    const { error: updateError } = await client.auth.updateUser({ password })
    if (updateError) throw updateError
  } finally {
    await client.auth.stopAutoRefresh()
  }
}
