import { hasAuthCallback } from './auth/recovery-callback'

export function isOptimizePage(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/optimize'
}

type Visit = {
  jobId: string | null
  resumeId?: string
  owner?: string
  unsubscribe?: () => void
}

let visit: Visit | undefined

export function selectOptimizePage(active: boolean, jobId: string | null) {
  if (active && visit?.jobId === jobId) return

  visit?.unsubscribe?.()
  visit = undefined

  if (!active || !isOptimizePage(window.location.pathname)) return

  const current: Visit = { jobId }

  visit = current

  import('@/store/user')
    .then(({ default: users }) => {
      if (visit !== current) return

      function prepare() {
        const owner = users.getState().currentUser?.id

        if (!owner) {
          current.owner = undefined

          return
        }

        import('@/pages/optimize/index').catch(() => {})

        if (jobId === null && !hasAuthCallback)
          prepareOptimizeReport(owner, null)
      }

      current.unsubscribe = users.subscribe((state, previous) => {
        if (state.currentUser?.id !== previous.currentUser?.id) prepare()
      })

      prepare()
    })
    .catch(() => {})
}

export function prepareOptimizeReport(
  owner: string,
  jobId: string | null,
  resumeId?: string,
) {
  if (
    !isOptimizePage(window.location.pathname) ||
    (new URLSearchParams(window.location.search).get('jobId') || null) !==
      jobId ||
    (jobId !== null && !resumeId)
  )
    return

  selectOptimizePage(true, jobId)

  const current = visit

  if (!current || (current.owner === owner && current.resumeId === resumeId))
    return

  current.owner = owner
  current.resumeId = resumeId

  Promise.all([import('@/pages/optimize/store'), import('@/store/user')])
    .then(([{ default: store }, { default: users }]) => {
      if (
        visit === current &&
        current.owner === owner &&
        current.resumeId === resumeId &&
        users.getState().currentUser?.id === owner
      )
        return store.getState().init(false, resumeId)
    })
    .catch(() => {
      if (current.owner === owner && current.resumeId === resumeId)
        current.owner = undefined
    })
}
