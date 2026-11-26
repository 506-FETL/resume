import supabase from '@/lib/supabase/client'
import useUserStore from '@/store/user'

let subscription: { unsubscribe: () => void } | undefined

export function startAuthSession() {
  if (subscription) return

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useUserStore.getState().setCurrentUser(session?.user ?? null)
  })

  subscription = data.subscription
}

export function stopAuthSession() {
  subscription?.unsubscribe()
  subscription = undefined
}
