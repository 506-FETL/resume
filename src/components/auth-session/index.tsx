import { useEffect } from 'react'
import supabase from '@/lib/supabase/client'
import useUserStore from '@/store/user'

export default function AuthSession() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      useUserStore.getState().setCurrentUser(session?.user ?? null)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return null
}
