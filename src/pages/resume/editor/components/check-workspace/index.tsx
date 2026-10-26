import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
import { useResumeCheckStore } from '../../store/checks'
import CheckPanel from '../check-panel'

export default function CheckWorkspace({
  children,
  header,
}: {
  children: ReactNode
  header: ReactNode
}) {
  const tab = useResumeCheckStore((state) => state.tab)
  const setTab = useResumeCheckStore((state) => state.setTab)
  const reduced = useReducedMotion()
  const duration = reduced ? 0 : DURATION.base

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as 'edit' | 'checks')}
      className='min-h-0 flex-1 gap-0'
      data-resume-check-workspace
    >
      {header}
      <div className='relative min-h-0 flex-1 overflow-hidden'>
        <TabsContent forceMount value='edit' asChild>
          <motion.div
            inert={tab !== 'edit'}
            aria-hidden={tab !== 'edit'}
            initial={false}
            animate={{ opacity: tab === 'edit' ? 1 : 0 }}
            transition={{ duration, ease: EASE.out }}
            className='absolute inset-0 m-0 flex min-h-0 flex-col overflow-hidden'
            style={{ pointerEvents: tab === 'edit' ? 'auto' : 'none' }}
          >
            {children}
          </motion.div>
        </TabsContent>
        <TabsContent forceMount value='checks' asChild>
          <motion.div
            inert={tab !== 'checks'}
            aria-hidden={tab !== 'checks'}
            initial={false}
            animate={{ opacity: tab === 'checks' ? 1 : 0 }}
            transition={{ duration, ease: EASE.out }}
            className='absolute inset-0 m-0 flex min-h-0 flex-col overflow-hidden'
            style={{ pointerEvents: tab === 'checks' ? 'auto' : 'none' }}
          >
            <CheckPanel />
          </motion.div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
