import { memo } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import { LoadingRegion } from '@/components/loading-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import type { TextPartProps } from './text-content/types'

const TextContent = createDeferredComponent<TextPartProps>(
  () => import('./text-content'),
  '回复正文',
  <LoadingRegion label='正在加载回复正文' className='space-y-2 py-1.5'>
    <Skeleton data-assistant-text-loading className='h-4 w-3/4' />
    <Skeleton className='h-4 w-1/2' />
  </LoadingRegion>,
  { wrapFallback: false },
)

export const TextPart = Object.assign(
  memo(function TextPart(props: TextPartProps) {
    return (
      <div data-assistant-text-part>
        <TextContent {...props} />
      </div>
    )
  }),
  { preload: TextContent.preload },
)
