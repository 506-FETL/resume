import supabase from '@/lib/supabase/client'

export let cachedAuthToken: string | null | undefined

export let cachedAuthUserId: string | null | undefined

export let authTokenPromise: Promise<string | null> | null = null

export let authListenerStarted = false

export function startAuthTokenListener() {
  if (authListenerStarted) return

  authListenerStarted = true

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAuthToken = session?.access_token ?? null
    cachedAuthUserId = session?.user.id ?? null
    authTokenPromise = null
  })
}

export async function getCommentAuthToken() {
  startAuthTokenListener()

  if (cachedAuthToken !== undefined) return cachedAuthToken

  authTokenPromise ??= supabase.auth.getSession().then(({ data }) => {
    cachedAuthToken = data.session?.access_token ?? null
    cachedAuthUserId = data.session?.user.id ?? null

    return cachedAuthToken
  })

  return authTokenPromise
}
