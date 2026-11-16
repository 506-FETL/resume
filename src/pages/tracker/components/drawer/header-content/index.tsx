import type { ReactNode } from 'react'
import type { JobApplication } from '../../../types'
import type { useJobDrawer } from '../use-job-drawer'
import { FocusButton } from '../../focus-button'
import { ArrowRight, BriefcaseBusiness, Pencil, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import { getTrackerNextAction } from '../../../utils'
import { CompanyLogo } from '../../company-logo'
import DrawerMetaBar from '../meta-bar'

type Props = { selectedJob: JobApplication; actionMenu: ReactNode } & Pick<
  ReturnType<typeof useJobDrawer>,
  | 'isMobile'
  | 'isEditing'
  | 'setIsEditing'
  | 'handleStageJump'
  | 'setCloseButtonRef'
  | 'handleOpenChange'
>

export function DrawerHeaderContent({
  selectedJob,
  actionMenu,
  isMobile,
  isEditing,
  setIsEditing,
  handleStageJump,
  setCloseButtonRef,
  handleOpenChange,
}: Props) {
  const statusConfig = APPLICATION_STATUS_CONFIG[selectedJob.status]

  const titleBlock = (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-start',
        isMobile ? 'gap-2.5' : 'gap-3',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary',
          isMobile ? 'size-10' : 'size-11',
        )}
      >
        <CompanyLogo
          logo={selectedJob.company_logo}
          company={selectedJob.company}
          icon={BriefcaseBusiness}
          imgClassName={isMobile ? 'size-6' : 'size-7'}
          iconClassName={isMobile ? 'size-4.5' : 'size-5'}
        />
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex items-center gap-2 text-xs'>
          <Badge
            className={cn(
              'rounded-full border-0 px-2 py-0.5 text-[11px] font-medium',
              statusConfig.bgColor,
              statusConfig.color,
            )}
          >
            {statusConfig.label}
          </Badge>
          <span className='truncate text-muted-foreground'>
            {selectedJob.company}
          </span>
        </div>
        <DrawerTitle
          className={cn(
            'line-clamp-1 leading-tight tracking-tight',
            isMobile ? 'text-base' : 'text-lg',
          )}
        >
          {selectedJob.position}
        </DrawerTitle>
      </div>
    </div>
  )

  const nextAction = getTrackerNextAction(selectedJob)

  const desktopToolbar = !isEditing && (
    <div className='flex items-center gap-1'>
      {nextAction.targetStatus && (
        <Button
          size='sm'
          className='h-8 gap-1.5 text-xs'
          onClick={() => handleStageJump(nextAction.targetStatus!)}
        >
          {nextAction.label}
          <ArrowRight className='size-3.5' />
        </Button>
      )}
      <Button
        variant='ghost'
        size='sm'
        className='h-8 gap-1.5 px-2 text-xs sm:px-3'
        aria-label='编辑信息'
        onClick={() => setIsEditing(true)}
      >
        <Pencil className='size-3.5' />
        <span className='hidden sm:inline'>编辑信息</span>
      </Button>
      <FocusButton job={selectedJob} />
      {actionMenu}
    </div>
  )

  return (
    <div className='flex flex-col gap-2 md:gap-3'>
      <div className='flex items-start justify-between gap-3'>
        {titleBlock}
        <div className='flex shrink-0 items-center gap-1'>
          {!isMobile && desktopToolbar}
          <Button
            ref={setCloseButtonRef}
            variant='ghost'
            size='icon-sm'
            aria-label='关闭详情'
            onClick={() => handleOpenChange(false)}
          >
            <X className='size-4' />
          </Button>
        </div>
      </div>
      <DrawerMetaBar />
    </div>
  )
}
