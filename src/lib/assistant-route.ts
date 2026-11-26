import { hasAuthCallback } from './auth/recovery-callback'

export function isAssistantPage(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/assistant'
}

let selected = false
let leave: (() => void) | undefined

export function selectAssistantPage(active: boolean) {
  if (active === selected || hasAuthCallback) return

  selected = active
  leave?.()
  leave = undefined

  if (!active) return

  import('@/store/user')
    .then(({ default: users }) => {
      if (!selected || !isAssistantPage(window.location.pathname)) return

      const prepare = () => {
        const owner = users.getState().currentUser?.id

        if (!owner) return

        import('@/pages/assistant').catch(() => {})

        import('@/pages/assistant/hooks/conversation-reads')
          .then(({ preloadAssistantHistory }) => {
            if (
              selected &&
              isAssistantPage(window.location.pathname) &&
              users.getState().currentUser?.id === owner
            )
              preloadAssistantHistory()
          })
          .catch(() => {})
      }

      leave?.()

      leave = users.subscribe((state, previous) => {
        if (state.currentUser?.id !== previous.currentUser?.id) prepare()
      })

      prepare()
    })
    .catch(() => {
      selected = false
    })
}
