import type { ReactNode, Ref } from 'react'
import type { DrawerTab } from '../../../types'
import { useReducedMotion } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { TabsContent } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
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
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{
          opacity: 0,
          y: 0,
          transition: {
            duration: reduce ? 0 : DURATION.fast,
            ease: EASE.in,
            delay: 0,
          },
        }}
        transition={{
          duration: reduce ? 0 : DURATION.base,
          ease: EASE.out,
          delay: reduce ? 0 : DURATION.fast,
        }}
      >
        {children}
      </PresenceDiv>
    </TabsContent>
  )
}
