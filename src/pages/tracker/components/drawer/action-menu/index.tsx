import type { JobApplication } from '../../../types'
import type { useJobDrawer } from '../use-job-drawer'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APPLICATION_STATUS_ORDER } from '../../../const'
import useTrackerStore from '../../../store'

type Props = { selectedJob: JobApplication; includeEdit: boolean } & Pick<
  ReturnType<typeof useJobDrawer>,
  'setIsEditing' | 'handleStepBack' | 'openConfirmation' | 'handleArchive'
>

export function DrawerActionMenu({
  selectedJob,
  includeEdit,
  setIsEditing,
  handleStepBack,
  openConfirmation,
  handleArchive,
}: Props) {
  const canStepBack =
    APPLICATION_STATUS_ORDER.indexOf(selectedJob.status) > 0 &&
    selectedJob.status !== 'rejected'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={includeEdit ? 'outline' : 'ghost'}
          size={includeEdit ? 'icon' : 'icon-sm'}
          aria-label='更多操作'
        >
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        {selectedJob.status === 'rejected' && (
          <DropdownMenuItem
            onClick={() => {
              useTrackerStore.getState().requestReopen(selectedJob.id)
            }}
          >
            <ArrowRight className='size-4' />
            恢复流程
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => useTrackerStore.getState().openAddDrawer(selectedJob)}
        >
          <BriefcaseBusiness className='size-4' />
          转到同公司其他岗位
        </DropdownMenuItem>
        {includeEdit && (
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className='size-4' />
            编辑信息
          </DropdownMenuItem>
        )}
        {includeEdit && <DropdownMenuSeparator />}
        <DropdownMenuItem disabled={!canStepBack} onClick={handleStepBack}>
          <ArrowLeft className='size-4' />
          回退到上一阶段
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={selectedJob.status === 'rejected'}
          onClick={() => openConfirmation('reject')}
          className='text-destructive focus:text-destructive'
        >
          <XCircle className='size-4' />
          结束该流程
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleArchive}>
          <Archive className='size-4' />
          {selectedJob.archived ? '取消归档' : '归档'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openConfirmation('delete')}
          className='text-destructive focus:text-destructive'
        >
          <Trash2 className='size-4' />
          删除该记录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
