import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'

export const CustomEditor = createDeferredComponent<
  ComponentProps<typeof import('./index').default>
>(() => import('./index'), '自定义建议')
