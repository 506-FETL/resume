import type { getCurrentUser } from '@/lib/supabase/user'
import { create } from 'zustand'

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

export default useUserStore
