import { FocusButton } from '../../../focus-button'
import type { JobApplication } from '../../../../types'
import {
  Archive,
  ArrowRight,
  Bell,
  Building2,
  ExternalLink,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { memo, type Ref } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PresenceTableRow } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_DOT_CLASSES,
  APPLICATION_STATUS_ORDER,
  NEXT_ACTION_TONE_CLASSES,
} from '../../../../const'
import useTrackerStore from '../../../../store'
import {
  getDaysInStage,
  getNextActionBadge,
  getTrackerNextAction,
} from '../../../../utils'
import { CompanyLogo } from '../../../company-logo'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'

  const d = new Date(dateStr)

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface JobTableRowProps {
  ref?: Ref<HTMLTableRowElement>
  job: JobApplication
  index: number
  layoutKey: { jobs: JobApplication[]; isSelectMode: boolean }
  onStatusChange: (
    job: JobApplication,
    status: JobApplication['status'],
  ) => void
  onArchive: (job: JobApplication) => void
  onDelete: (job: JobApplication) => void
}

export const JobTableRow = memo(
  ({
    ref,
    job,
    index,
    layoutKey,
    onStatusChange,
    onArchive,
    onDelete,
  }: JobTableRowProps) => {
    const { isSelectMode, isSelected, toggleSelect, openJobDrawer } =
      useTrackerStore(
        useShallow((state) => ({
          isSelectMode: state.isSelectMode,
          isSelected: state.selectedIds.has(job.id),
          toggleSelect: state.toggleSelect,
          openJobDrawer: state.openJobDrawer,
        })),
      )

    const reduce = useReducedMotion()
    const isPresent = useIsPresent()
    const statusConfig = APPLICATION_STATUS_CONFIG[job.status]
    const nextAction = getTrackerNextAction(job)
    const nextActionBadge = getNextActionBadge(job)
    const daysInStage = getDaysInStage(job)

    const handleRowClick = () => {
      if (!isPresent) return
      if (isSelectMode) toggleSelect(job.id)
      else openJobDrawer(job)
    }

    return (
      <PresenceTableRow
        ref={ref}
        key={job.id}
        layout={reduce ? false : 'position'}
        layoutDependency={layoutKey}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{
          opacity: 0,
          transition: {
            duration: reduce ? 0 : DURATION.fast,
            delay: 0,
            ease: EASE.in,
          },
        }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: DURATION.base,
                delay: staggerDelay(Math.min(index, 8)),
                ease: EASE.out,
                layout: {
                  type: 'tween',
                  duration: DURATION.base,
                  ease: EASE.out,
                },
              }
        }
        onClick={handleRowClick}
        className={cn(
          'group cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/35',
          isSelected && 'bg-primary/5',
        )}
        style={{ transitionDuration: `${reduce ? 0 : DURATION.fast}s` }}
      >
        {isSelectMode && (
          <td className='px-4 py-4' onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              aria-label={`选择 ${job.company} ${job.position}`}
              onCheckedChange={() => isPresent && toggleSelect(job.id)}
            />
          </td>
        )}
        <td className='px-4 py-4'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
              <CompanyLogo
                logo={job.company_logo}
                company={job.company}
                icon={Building2}
              />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-1.5'>
                <span className='truncate text-xs font-medium text-muted-foreground'>
                  {job.company}
                </span>
                {job.archived && (
                  <span className='shrink-0 rounded-full border px-1.5 py-0 text-xs font-medium text-muted-foreground'>
                    已归档
                  </span>
                )}
              </div>
              <Button
                variant='ghost'
                type='button'
                className='mt-1 block h-auto w-full rounded-sm p-0 text-left font-semibold leading-5 text-foreground whitespace-normal hover:bg-transparent'
                aria-label={
                  isSelectMode
                    ? `选择 ${job.position}`
                    : `查看 ${job.company} ${job.position}`
                }
                onClick={(event) => {
                  event.stopPropagation()
                  handleRowClick()
                }}
              >
                <span className='line-clamp-2 break-words'>{job.position}</span>
              </Button>
              {job.recruitment_batch && (
                <p className='mt-1 truncate text-xs text-muted-foreground'>
                  {job.recruitment_batch}
                </p>
              )}
            </div>
            <FocusButton job={job} />
          </div>
        </td>
        <td className='hidden px-3 py-3 text-xs @min-[880px]/jobs:table-cell'>
          <p className='truncate'>{job.location || '地点未填写'}</p>
          <p className='mt-1 truncate text-muted-foreground'>
            {job.salary || '薪资未填写'}
          </p>
        </td>
        <td className='px-3 py-3 text-xs'>
          <span className='inline-flex items-center gap-1.5 font-medium'>
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                APPLICATION_STATUS_DOT_CLASSES[job.status],
              )}
            />
            {statusConfig.label}
          </span>
          <p className='mt-1 text-muted-foreground'>
            {daysInStage === 0 ? '今天更新' : `${daysInStage} 天未更新`}
          </p>
        </td>
        <td className='hidden px-3 py-3 text-xs @min-[680px]/jobs:table-cell'>
          <p
            className={cn(
              'line-clamp-2 break-words leading-5',
              !job.next_action && 'text-muted-foreground',
            )}
          >
            {job.next_action || '未设置下一步'}
          </p>
          {nextActionBadge && (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium',
                NEXT_ACTION_TONE_CLASSES[nextActionBadge.tone],
              )}
            >
              <Bell className='size-2.5' />
              {nextActionBadge.label}
            </span>
          )}
        </td>
        <td className='hidden whitespace-nowrap px-3 py-3 text-xs text-muted-foreground @min-[1100px]/jobs:table-cell'>
          {formatDate(job.updated_at)}
        </td>
        <td className='px-4 py-4' onClick={(e) => e.stopPropagation()}>
          <div className='flex items-center justify-end gap-1'>
            {nextAction.targetStatus && (
              <Button
                variant='ghost'
                size='sm'
                className='hidden h-8 gap-1 px-2 text-xs @min-[680px]/jobs:inline-flex'
                onClick={() =>
                  isPresent && onStatusChange(job, nextAction.targetStatus!)
                }
              >
                {nextAction.label}
                <ArrowRight />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon-sm' aria-label='更多操作'>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                inert={!isPresent}
                aria-hidden={!isPresent || undefined}
                align='end'
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => isPresent && openJobDrawer(job)}
                  >
                    查看详情
                  </DropdownMenuItem>
                  {job.job_url && (
                    <DropdownMenuItem asChild>
                      <a
                        href={job.job_url}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <ExternalLink data-icon='inline-start' />
                        打开 JD
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {APPLICATION_STATUS_ORDER.filter(
                    (status) => status !== job.status,
                  ).map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => isPresent && onStatusChange(job, status)}
                    >
                      标记为
                      {APPLICATION_STATUS_CONFIG[status].label}
                    </DropdownMenuItem>
                  ))}
                  {job.status !== 'rejected' && (
                    <DropdownMenuItem
                      onClick={() =>
                        isPresent && onStatusChange(job, 'rejected')
                      }
                    >
                      终止流程
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => isPresent && onArchive(job)}>
                  <Archive data-icon='inline-start' />
                  {job.archived ? '取消归档' : '归档'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant='destructive'
                  onClick={() => isPresent && onDelete(job)}
                >
                  <Trash2 data-icon='inline-start' />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </PresenceTableRow>
    )
  },
)
