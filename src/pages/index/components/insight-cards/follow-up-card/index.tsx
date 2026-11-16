import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { NEXT_ACTION_TONE_CLASSES } from '@/pages/tracker/const'
import { ArrowRight, BellRing } from 'lucide-react'
import { useIsPresent } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import type { FollowUpJob } from '../../../insights'
import { CardHead } from '../card-head/index'

// ==================== 待跟进岗位 Top3 ====================
function followUpTone(daysUntil: number | null): {
  text: string
  tone: 'overdue' | 'today' | 'upcoming'
} {
  if (daysUntil === null) return { text: '长时间未推进', tone: 'upcoming' }
  if (daysUntil < 0)
    return { text: `逾期 ${Math.abs(daysUntil)} 天`, tone: 'overdue' }
  if (daysUntil === 0) return { text: '今天跟进', tone: 'today' }
  if (daysUntil === 1) return { text: '明天跟进', tone: 'upcoming' }

  return { text: `${daysUntil} 天后`, tone: 'upcoming' }
}

export function FollowUpCard({
  followUps,
  total,
}: {
  followUps: FollowUpJob[]
  total: number
}) {
  const navigate = useNavigate()
  const isPresent = useIsPresent()

  if (followUps.length === 0) return null

  return (
    <Card
      className='flex flex-col'
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
    >
      <CardHead
        icon={<BellRing className='size-4' />}
        title='待跟进岗位'
        description='已到期或长时间未推进的岗位'
      />
      <CardContent className='min-w-0 flex-1 px-0 pt-0'>
        <div className='flex flex-col gap-2'>
          {followUps.map((job) => {
            const badge = followUpTone(job.daysUntil)

            return (
              <button
                type='button'
                key={job.id}
                onClick={() => navigate('/tracker')}
                className='group flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 hover:border-border/80'
              >
                <div className='min-w-0'>
                  <p className='text-sm font-medium truncate'>{job.company}</p>
                  <p className='text-xs text-muted-foreground truncate'>
                    {job.position}
                    {' · '}
                    {job.statusLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    NEXT_ACTION_TONE_CLASSES[badge.tone],
                  )}
                >
                  {badge.text}
                </span>
              </button>
            )
          })}
        </div>
        {total > followUps.length && (
          <button
            type='button'
            onClick={() => navigate('/tracker')}
            className='mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
          >
            还有
            <span className='font-medium text-foreground'>
              {total - followUps.length}
            </span>
            个待跟进
            <ArrowRight className='size-3' />
          </button>
        )}
      </CardContent>
    </Card>
  )
}
