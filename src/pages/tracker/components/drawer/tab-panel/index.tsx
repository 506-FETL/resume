import type { ReactNode, Ref } from 'react'
import type { DrawerTab } from '../../../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { TabsContent } from '@/components/ui/tabs'
import { CONTENT_SWITCH } from '@/lib/motion'
import { cn } from '@/lib/utils'

export default function DrawerTabPanel({
  ref,
  value,
  children,
}: {
  ref?: Ref<HTMLDivElement>
  value: DrawerTab
  children: ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <TabsContent value={value} forceMount asChild>
      <PresenceDiv
        ref={ref}
        className={cn(
          'scrollbar-thin-subtle flex min-h-0 flex-1 flex-col overscroll-contain [@media(max-height:640px)]:overflow-visible',
          value === 'follow-up'
            ? 'overflow-hidden'
            : 'scrollbar-gutter-stable overflow-y-auto',
        )}
        initial={reduce ? false : { opacity: 0, transform: 'translateY(4px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        exit={{
          opacity: 0,
          transform: 'translateY(0px)',
          transition: {
            ...CONTENT_SWITCH.exit,
            ...(reduce && { duration: 0 }),
            delay: 0,
          },
        }}
        transition={{
          ...CONTENT_SWITCH.enter,
          ...(reduce && { duration: 0 }),
          delay: reduce ? 0 : CONTENT_SWITCH.exit.duration,
        }}
      >
        {children}
      </PresenceDiv>
    </TabsContent>
  )
}
