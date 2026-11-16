import { motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, type ComponentProps, type Ref } from 'react'
import { MessageScrollerItem } from '@/components/ui/message-scroller'
import { DURATION, EASE } from '@/lib/motion'
import ConfirmCard from '../../confirm-card'
import { MessageBubble } from '../../message-bubble'

export const MessageRow = memo(function MessageRow({
  message,
  onEditSave,
  onRegenerate,
  highlighted,
  showConfirmation,
  hasConfirmation,
  ref,
}: ComponentProps<typeof MessageBubble> & {
  highlighted: boolean
  showConfirmation: boolean
  hasConfirmation: boolean
  ref?: Ref<HTMLDivElement>
}) {
  const isPresent = useIsPresent()
  const reducedMotion = useReducedMotion()

  return (
    <MessageScrollerItem
      ref={ref}
      messageId={message.id}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
    >
      <motion.div
        id={`assistant-message-${message.id}`}
        initial={false}
        animate={
          highlighted && !reducedMotion
            ? {
                opacity: 1,
                backgroundColor: [
                  'color-mix(in oklab, var(--primary) 0%, transparent)',
                  'color-mix(in oklab, var(--primary) 10%, transparent)',
                  'color-mix(in oklab, var(--primary) 0%, transparent)',
                ],
              }
            : { opacity: 1, backgroundColor: 'transparent' }
        }
        exit={{ opacity: 0 }}
        transition={{
          backgroundColor: { duration: reducedMotion ? 0 : 1.8 },
          opacity: {
            duration: reducedMotion || !hasConfirmation ? 0 : DURATION.fast,
            ease: EASE.in,
          },
        }}
        className='scroll-mt-20 rounded-2xl'
      >
        <MessageBubble
          message={message}
          onEditSave={onEditSave}
          onRegenerate={onRegenerate}
        />
        {showConfirmation && <ConfirmCard />}
      </motion.div>
    </MessageScrollerItem>
  )
})
