import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'

export const AtsPreviewTool = createDeferredComponent<
  ComponentProps<typeof import('./ats-preview').default>
>(() => import('./ats-preview'), 'ATS 预览')

export const BenchmarkTool = createDeferredComponent<
  ComponentProps<typeof import('./benchmark').default>
>(() => import('./benchmark'), '行业对标')

export const FormatterTool = createDeferredComponent<
  ComponentProps<typeof import('./formatter').default>
>(() => import('./formatter'), '格式检查')

export const JobDescriptionTool = createDeferredComponent<
  ComponentProps<typeof import('./job-description').default>
>(() => import('./job-description'), '岗位匹配')

export const ToolMeta = createDeferredComponent<
  ComponentProps<typeof import('./shared/tool-meta').default>
>(() => import('./shared/tool-meta'), '简历概况', null, { wrapFallback: false })
