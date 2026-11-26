import { createDeferredComponent } from '@/components/deferred-content'
import { TrackerContentSkeleton } from '@/components/page-skeletons/tracker'
import type { JobApplication } from '../../types'

type ViewProps = { jobs: JobApplication[] }

export const BoardView = createDeferredComponent<ViewProps>(
  () => import('../board'),
  '职位看板',
  <TrackerContentSkeleton viewMode='board' />,
  { wrapFallback: false },
)

export const DesktopList = createDeferredComponent<ViewProps>(
  () => import('../list/desktop'),
  '职位列表',
  <TrackerContentSkeleton viewMode='list' />,
  { wrapFallback: false },
)

export const MobileList = createDeferredComponent<ViewProps>(
  () => import('../list'),
  '职位列表',
  <TrackerContentSkeleton viewMode='list' />,
  { wrapFallback: false },
)
