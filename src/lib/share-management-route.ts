import { hasAuthCallback } from './auth/recovery-callback'

export function isShareManagement(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/share'
}

function canPrepare() {
  return (
    isShareManagement(window.location.pathname) &&
    !hasAuthCallback &&
    !new URLSearchParams(window.location.search).has('jobId')
  )
}

let selected = false
let unsubscribe: (() => void) | undefined
let release: (() => void) | undefined

export function selectShareManagement(active: boolean) {
  if (selected === active) return

  selected = active
  unsubscribe?.()
  release?.()
  unsubscribe = undefined
  release = undefined

  if (!active || !canPrepare()) return

  import('@/store/user')
    .then(({ default: users }) => {
      if (!selected || !canPrepare() || unsubscribe) return

      const prepare = () => {
        const owner = users.getState().currentUser?.id

        if (!owner || !canPrepare()) return

        import('@/pages/share').catch(() => {})

        import('@/pages/share/store/management-visit')
          .then(({ prepareManagementVisit }) => {
            if (
              selected &&
              canPrepare() &&
              owner === users.getState().currentUser?.id
            )
              release = prepareManagementVisit()
          })
          .catch(() => {})
      }

      unsubscribe = users.subscribe((state, previous) => {
        if (state.currentUser?.id !== previous.currentUser?.id) prepare()
      })

      prepare()
    })
    .catch(() => {})
}
