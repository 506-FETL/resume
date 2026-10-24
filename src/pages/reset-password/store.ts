import type { RecoveryIdentity, RecoveryStatus } from './types'
import { create } from 'zustand'
import { recoveryCallback } from '@/lib/auth/recovery-callback'
import supabase from '@/lib/supabase/client'
import { INVALID_RECOVERY_MESSAGE } from './const'
import {
  isSameRecovery,
  updateRecoveryPassword,
  validateRecoveryPassword,
  verifyRecoveryIdentity,
} from './utils'

interface RecoveryStore {
  status: RecoveryStatus
  identity: RecoveryIdentity | null
  error: string | null
  submitting: boolean
  shouldRedirect: boolean
  finishNavigation: () => void
  initialize: () => Promise<void>
  submit: (password: string, confirmation: string) => Promise<boolean>
}

let initialization: Promise<void> | undefined
let revision = 0
const expectsRecovery =
  recoveryCallback.isResetPage || recoveryCallback.isRecovery
const hasAuthCallback =
  expectsRecovery ||
  recoveryCallback.hasTokens ||
  recoveryCallback.hasCode ||
  recoveryCallback.hasError

export const useRecoveryStore = create<RecoveryStore>((set, get) => ({
  status: hasAuthCallback ? 'checking' : 'idle',
  identity: null,
  error: null,
  submitting: false,
  shouldRedirect: false,
  finishNavigation: () => set({ shouldRedirect: false }),
  initialize: () => {
    initialization ??= (async () => {
      if (!hasAuthCallback) return
      const { error } = await supabase.auth.initialize()
      if (
        recoveryCallback.hasError ||
        (error &&
          (expectsRecovery ||
            recoveryCallback.hasTokens ||
            recoveryCallback.hasCode)) ||
        (recoveryCallback.hasCode &&
          new URL(window.location.href).searchParams.has('code'))
      ) {
        set({
          status: 'invalid',
          error: INVALID_RECOVERY_MESSAGE,
          shouldRedirect: true,
        })
        return
      }
      if (
        expectsRecovery ||
        recoveryCallback.hasTokens ||
        recoveryCallback.hasCode
      )
        await checkRecovery(expectsRecovery)
      else set({ status: 'idle' })
    })().catch(() => {
      set({
        status: 'invalid',
        error: INVALID_RECOVERY_MESSAGE,
        shouldRedirect: true,
      })
    })
    return initialization
  },
  submit: async (password, confirmation) => {
    if (get().submitting) return false
    const validationError = validateRecoveryPassword(password, confirmation)
    if (validationError) {
      set({ error: validationError })
      return false
    }
    const original = get().identity
    if (get().status !== 'ready' || !original) {
      set({ status: 'invalid', error: INVALID_RECOVERY_MESSAGE })
      return false
    }
    set({ submitting: true, error: null })
    try {
      const current = await verifyRecoveryIdentity()
      if (!isSameRecovery(original, current) || get().identity !== original)
        throw new Error(INVALID_RECOVERY_MESSAGE)
      await updateRecoveryPassword(current, password)
      ++revision
      set({ status: 'success', identity: null, error: null })
      // Keep the current session: an automatic signOut could target a later
      // sign-in in another tab. Signing out remains an explicit account action.
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '密码重置失败，请稍后重试。'
      set({
        error: message,
        ...(message === INVALID_RECOVERY_MESSAGE
          ? { status: 'invalid' as const, identity: null }
          : {}),
      })
      return false
    } finally {
      set({ submitting: false })
    }
  },
}))

async function checkRecovery(required: boolean) {
  const currentRevision = ++revision
  try {
    const identity = await verifyRecoveryIdentity()
    if (revision === currentRevision)
      useRecoveryStore.setState({
        status: 'ready',
        identity,
        error: null,
        shouldRedirect: true,
      })
  } catch {
    if (revision === currentRevision)
      useRecoveryStore.setState({
        status: required ? 'invalid' : 'idle',
        identity: null,
        error: required ? INVALID_RECOVERY_MESSAGE : null,
        shouldRedirect: required,
      })
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  const state = useRecoveryStore.getState()
  if (event === 'PASSWORD_RECOVERY' && state.status !== 'success') {
    // Auth callbacks run under the SDK lock: never await Auth methods here.
    setTimeout(() => {
      checkRecovery(true)
    }, 0)
  } else if (
    state.identity &&
    (event === 'SIGNED_OUT' ||
      (event === 'SIGNED_IN' &&
        session?.access_token !== state.identity.session.access_token))
  ) {
    ++revision
    useRecoveryStore.setState({
      status: 'invalid',
      identity: null,
      error: INVALID_RECOVERY_MESSAGE,
    })
  }
})
