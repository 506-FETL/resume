import { hasAuthCallback } from './auth/recovery-callback'
import { isCloudResumeId } from './resume-id'

export function isHistoryPage(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/history'
}

interface HistoryVisit {
  jobId: string | null
  target?: string
  unsubscribe?: () => void
  releaseOptions?: () => void
  releaseVersions?: () => void
}

let visit: HistoryVisit | undefined

export function selectHistoryPage(active: boolean, jobId: string | null) {
  if (active && visit?.jobId === jobId) return

  visit?.unsubscribe?.()
  visit?.releaseOptions?.()
  visit?.releaseVersions?.()
  visit = undefined

  if (!active || !isHistoryPage(window.location.pathname)) return

  const current: HistoryVisit = { jobId }

  visit = current

  Promise.all([import('@/store/user'), import('@/store/resume/current')])
    .then(([{ default: users }, { default: resumes }]) => {
      if (visit !== current) return

      const prepare = () => {
        const owner = users.getState().currentUser?.id

        if (!owner) {
          current.target = undefined

          return
        }

        import('@/pages/history/index').catch(() => {})

        if (!jobId && !hasAuthCallback)
          prepareHistoryTarget(owner, null, resumes.getState().resumeId)
      }

      current.unsubscribe = users.subscribe((state, previous) => {
        if (state.currentUser?.id !== previous.currentUser?.id) prepare()
      })

      prepare()
    })
    .catch(() => {})
}

export function prepareHistoryTarget(
  owner: string,
  jobId: string | null,
  id: string | null,
) {
  if (
    !isHistoryPage(window.location.pathname) ||
    (new URLSearchParams(window.location.search).get('jobId') || null) !== jobId
  )
    return

  selectHistoryPage(true, jobId)

  const current = visit
  const resumeId = isCloudResumeId(id) ? id : null
  const target = JSON.stringify([owner, resumeId])

  if (!current || current.target === target) return

  current.target = target

  if (!resumeId) {
    current.releaseVersions?.()
    current.releaseVersions = undefined
  }

  const active = () => current === visit && current.target === target

  Promise.all([import('@/pages/history/store/options'), import('@/store/user')])
    .then(([options, { default: users }]) => {
      if (!active() || users.getState().currentUser?.id !== owner) return

      current.releaseOptions = options.resetHistoryOptions

      if (!resumeId)
        return options.useResumeOptions.getState().load(owner, 'probe')
    })
    .catch(() => {})

  if (resumeId) {
    import('@/pages/history/components/workspace').catch(() => {})

    Promise.all([import('@/pages/history/store'), import('@/store/user')])
      .then(([{ default: history }, { default: users }]) => {
        if (!active() || users.getState().currentUser?.id !== owner) return

        current.releaseVersions = () => history.getState().init(null)

        return history.getState().init(resumeId)
      })
      .catch(() => {
        if (active()) current.target = undefined
      })
  }
}
