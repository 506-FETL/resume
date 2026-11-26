import useUserStore from '@/store/user'
import { getExperienceListSource } from './utils'
import {
  experiencePage,
  type getExperienceTarget,
} from '@/lib/experience-route'

export function beginExperienceVisit(
  target: ReturnType<typeof getExperienceTarget>,
) {
  let active = true
  let clear: (() => void) | undefined

  function prepare() {
    const user = useUserStore.getState().currentUser

    if (!user) return

    experiencePage.load().catch(() => {})

    Promise.all([import('@/store/experience-sources'), import('./store')])
      .then(([sources, { useExperiencePageStore }]) => {
        const data = sources.useExperienceSourcesStore.getState()

        if (!active || data.ownerId !== user.id) return

        clear = sources.clearExperiencePreload

        const page = useExperiencePageStore.getState()
        const kind = page.filter === 'all' ? undefined : page.filter

        const sourceId =
          target?.sourceId ?? (page.detailOpen ? page.sourceId : null)

        if (sourceId) {
          const requestedVersion = target ? target.versionId : page.versionId

          const versionId =
            requestedVersion ??
            getExperienceListSource(data, page, sourceId)?.currentVersionId

          return sources.preloadExperienceRead(sourceId, versionId ?? undefined)
        }
        if (!page.deleting && !page.uploadOpen)
          return sources.preloadExperienceList(page.query, page.offset, kind)
      })
      .catch(() => {})
  }

  const unsubscribe = useUserStore.subscribe((state, previous) => {
    if (state.currentUser?.id !== previous.currentUser?.id) prepare()
  })

  prepare()

  return () => {
    active = false
    unsubscribe()
    clear?.()
  }
}
