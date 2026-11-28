import { memo } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import type { TextPartProps } from './text-content/types'

const TextContent = createDeferredComponent<TextPartProps>(
  () => import('./text-content'),
  '回复正文',
  ({ text }) => (
    <div
      data-assistant-text-loading
      className='whitespace-pre-wrap wrap-anywhere'
    >
      {text}
    </div>
  ),
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
