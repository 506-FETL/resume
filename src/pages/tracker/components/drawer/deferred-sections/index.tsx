import { createDeferredComponent } from '@/components/deferred-content'
import { ContentSkeleton } from '@/components/loading-skeleton'
import type { ComponentProps } from 'react'

export const DrawerStageDetail = createDeferredComponent<
  ComponentProps<typeof import('../stage-detail').default>
>(() => import('../stage-detail'), '阶段详情')

export const DrawerEditForm = createDeferredComponent<
  ComponentProps<typeof import('../edit-form').default>
>(() => import('../edit-form'), '职位编辑表单')

export const TrackerCalendar = createDeferredComponent<
  ComponentProps<typeof import('@/components/ui/calendar').Calendar>
>(
  () =>
    import('@/components/ui/calendar').then(({ Calendar }) => ({
      default: Calendar,
    })),
  '日期选择器',
  <ContentSkeleton
    label='正在加载日期选择器'
    rows={5}
    className='min-h-64 min-w-60 p-4'
  />,
  { wrapFallback: false },
)
