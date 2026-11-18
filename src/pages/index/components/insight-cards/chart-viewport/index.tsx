import type { ReactNode } from 'react'
import { useRef } from 'react'
import { useInView } from 'motion/react'
import { DashboardChartSkeleton } from '@/components/page-skeletons/dashboard'
import { CHART_HEIGHT } from '../const'

export function ChartViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { once: true, margin: '200px 0px' })

  return (
    <div ref={ref} className={CHART_HEIGHT}>
      {visible ? children : <DashboardChartSkeleton />}
    </div>
  )
}
