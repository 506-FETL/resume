import { preloadComponent } from './preload-component'
import type { ExperienceLocationState } from '@/pages/experience/types'

export const experiencePage = preloadComponent(
  () => import('@/pages/experience/components/archive-page'),
)

export function isExperienceArchive(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/experience'
}

export function getExperienceTarget(
  search: string,
  state: ExperienceLocationState | null,
) {
  const params = new URLSearchParams(search)

  const target = params.has('sourceId')
    ? {
        sourceId: params.get('sourceId'),
        versionId: params.get('versionId'),
        blockId: params.get('blockId'),
      }
    : state

  if (typeof target?.sourceId !== 'string' || !target.sourceId) return null

  return {
    sourceId: target.sourceId,
    versionId:
      typeof target.versionId === 'string' ? target.versionId : undefined,
    blockId: typeof target.blockId === 'string' ? target.blockId : undefined,
  }
}

let selected: string | undefined
let leave: (() => void) | undefined

export function selectExperienceArchive(key?: string) {
  if (selected === key) return

  leave?.()
  leave = undefined
  selected = key

  if (!key) return

  const target = getExperienceTarget(
    window.location.search,
    window.history.state?.usr,
  )

  import('@/pages/experience/startup')
    .then(({ beginExperienceVisit }) => {
      if (selected === key && isExperienceArchive(window.location.pathname))
        leave = beginExperienceVisit(target)
    })
    .catch(() => {
      if (selected === key) selected = undefined
    })
}
