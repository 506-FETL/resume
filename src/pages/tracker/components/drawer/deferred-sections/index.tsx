import { createDeferredComponent } from '@/components/deferred-content'
import { LoadingStatus } from '@/components/loading-status'
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
  <LoadingStatus
    label='正在加载日历'
    className='grid h-68 w-64 place-items-center'
  />,
  { wrapFallback: false },
)
