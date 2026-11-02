import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { createDeferredComponent } from '@/components/deferred-content'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
import { useResumeCheckStore } from '../../store/checks'

const CheckPanel = createDeferredComponent(
  () => import('../check-panel'),
  '检查面板',
)

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
  const [checksVisited, setChecksVisited] = useState(tab === 'checks')

  useEffect(() => {
    if (tab === 'checks') setChecksVisited(true)
  }, [tab])

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
            transition={{
              duration: reduced
                ? 0
                : tab === 'edit'
                  ? DURATION.base
                  : DURATION.fast,
              delay: reduced || tab !== 'edit' ? 0 : DURATION.fast,
              ease: tab === 'edit' ? EASE.out : EASE.in,
            }}
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
            transition={{
              duration: reduced
                ? 0
                : tab === 'checks'
                  ? DURATION.base
                  : DURATION.fast,
              delay: reduced || tab !== 'checks' ? 0 : DURATION.fast,
              ease: tab === 'checks' ? EASE.out : EASE.in,
            }}
            className='absolute inset-0 m-0 flex min-h-0 flex-col overflow-hidden'
            style={{ pointerEvents: tab === 'checks' ? 'auto' : 'none' }}
          >
            {checksVisited || tab === 'checks' ? <CheckPanel /> : null}
          </motion.div>
        </TabsContent>
      </div>
    </Tabs>
  )
}
