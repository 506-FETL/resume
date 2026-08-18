import type { getCurrentUser } from '@/lib/supabase/user'
import { create } from 'zustand'
import supabase from '@/lib/supabase/client'

export type SupabaseUser = Awaited<ReturnType<typeof getCurrentUser>> | null
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

interface UserStore {
  currentUser: SupabaseUser
  authStatus: AuthStatus
  setCurrentUser: (user: SupabaseUser) => void
}

const useUserStore = create<UserStore>()(set => ({
  currentUser: null,
  authStatus: 'unknown',
  setCurrentUser: user => set({
    currentUser: user,
    authStatus: user ? 'authenticated' : 'anonymous',
  }),
}))

supabase.auth.onAuthStateChange((_event, session) => {
  useUserStore.getState().setCurrentUser(session?.user ?? null)
})

export default useUserStore
