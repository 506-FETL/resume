import { hasAuthCallback } from './auth/recovery-callback'

export function isTrackerPage(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/tracker'
}

let active = false
let unsubscribe: (() => void) | undefined

export function selectTrackerPage(selected: boolean) {
  if (selected === active) return

  active = selected
  unsubscribe?.()
  unsubscribe = undefined

  const current = () =>
    active && !hasAuthCallback && isTrackerPage(window.location.pathname)

  if (!current()) return

  import('@/store/user')
    .then(({ default: users }) => {
      if (!current() || unsubscribe) return

      function prepare() {
        const owner = users.getState().currentUser?.id

        if (!owner || !current()) return

        import('@/pages/tracker').catch(() => {})

        const mobile = window.matchMedia('(max-width: 767px)').matches
        const view = import('@/pages/tracker/lib/preload-view')

        if (mobile)
          view
            .then(({ preloadTrackerView }) => preloadTrackerView('list'))
            .catch(() => {})
        else view.catch(() => {})

        import('@/pages/tracker/store')
          .then(({ default: tracker, showFocusedTrackerJobs }) => {
            if (!current() || tracker.getState().accountScope.userId !== owner)
              return

            const mode = mobile ? 'list' : tracker.getState().viewMode
            const params = new URLSearchParams(window.location.search)

            if (!mobile)
              view
                .then(({ preloadTrackerView }) => preloadTrackerView(mode))
                .catch(() => {})
            if (params.get('focus') === '1') showFocusedTrackerJobs()

            tracker
              .getState()
              .ensureJobsView(mode)
              .catch(() => {})
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
