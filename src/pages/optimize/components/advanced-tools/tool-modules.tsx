import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { ContentSkeleton } from '@/components/loading-skeleton'

const fallback = (
  <ContentSkeleton label='正在加载工具' className='min-h-48 px-0' rows={3} />
)

export const AtsPreviewTool = createDeferredComponent<
  ComponentProps<typeof import('./ats-preview').default>
>(() => import('./ats-preview'), 'ATS 预览', fallback, { wrapFallback: false })

export const BenchmarkTool = createDeferredComponent<
  ComponentProps<typeof import('./benchmark').default>
>(() => import('./benchmark'), '行业对标', fallback, { wrapFallback: false })

export const FormatterTool = createDeferredComponent<
  ComponentProps<typeof import('./formatter').default>
>(() => import('./formatter'), '格式检查', fallback, { wrapFallback: false })

export const JobDescriptionTool = createDeferredComponent<
  ComponentProps<typeof import('./job-description').default>
>(() => import('./job-description'), '岗位匹配', fallback, {
  wrapFallback: false,
})

export const ToolMeta = createDeferredComponent<
  ComponentProps<typeof import('./shared/tool-meta').default>
>(() => import('./shared/tool-meta'), '简历概况', null, { wrapFallback: false })
