import { ListChecks, PencilLine } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useId } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useResumeCheckStore } from '../../store/checks'
import {
  CHECK_LEVELS,
  highestCheckSeverity,
} from '../../utils/check-presentation'

export function CheckModeToggle() {
  const tab = useResumeCheckStore((state) => state.tab)
  const issues = useResumeCheckStore((state) => state.issues)
  const reduced = useReducedMotion()
  const isMobile = useIsMobile()
  const id = useId()
  const count = issues.filter((issue) => !issue.resolved).length
  const severity = highestCheckSeverity(issues)

  return (
    <TabsList
      aria-label='编辑模式'
      className={cn(
        'shrink-0',
        isMobile
          ? 'group-data-[orientation=horizontal]/tabs:h-9'
          : 'group-data-[orientation=horizontal]/tabs:h-8',
      )}
    >
      {(['edit', 'checks'] as const).map((value) => {
        const Icon = value === 'edit' ? PencilLine : ListChecks

        const label =
          value === 'edit' ? '编辑' : `检查${count ? ` ${count}` : ''}`

        return (
          <TabsTrigger
            key={value}
            value={value}
            data-check-mode={value}
            data-severity={value === 'checks' ? severity : undefined}
            aria-label={label}
            title={label}
            className={cn(
              'relative isolate transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent',
              isMobile ? 'size-8 px-0' : 'px-2.5',
              value === 'checks' && severity && CHECK_LEVELS[severity].color,
              value === 'checks' &&
                severity === 'error' &&
                'data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300',
              value === 'checks' &&
                severity === 'warning' &&
                'data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300',
              value === 'checks' &&
                severity === 'suggestion' &&
                'data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300',
            )}
            style={{ transitionDuration: `${reduced ? 0 : DURATION.fast}s` }}
          >
            {tab === value && (
              <motion.span
                layoutId={`check-tab-${id}`}
                className={cn(
                  'absolute inset-0 -z-10 rounded-md bg-background shadow-xs',
                  value === 'checks' &&
                    severity &&
                    CHECK_LEVELS[severity].badge,
                )}
                transition={{
                  duration: reduced ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
              />
            )}
            {isMobile ? <Icon /> : label}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
