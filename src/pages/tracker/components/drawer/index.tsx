import type { ApplicationStatus, JobApplication } from '../../types'
// Drawer主组件
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DrawerHeader } from './drawer-header'
import { DrawerProgress } from './drawer-progress'
import { DrawerStageDetail } from './drawer-stage-detail'

// Re-export AddJobDrawer
export { AddJobDrawer } from './drawer-add-job'

interface JobDrawerProps {
  job: JobApplication | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (jobId: string, status: ApplicationStatus) => void
  onJobUpdate?: (job: JobApplication) => void
}
export function JobDrawer({
  job,
  open,
  onOpenChange,
  onStatusChange,
  onJobUpdate,
}: JobDrawerProps) {
  if (!job)
    return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto rounded-l-2xl p-0">
        <SheetHeader>
          <SheetTitle className="sr-only">职位详情</SheetTitle>
        </SheetHeader>
        <div className="p-6 space-y-6">

          {/* 上模块：公司信息 */}
          <DrawerHeader
            job={job}
            onEdit={() => toast.warning('功能待开发')}
          />
          {/* 中模块：进度条 */}
          <DrawerProgress
            currentStatus={job.status}
            onStatusChange={status => onStatusChange?.(job.id, status)}
          />
          {/* 下模块：阶段详情 */}
          <DrawerStageDetail
            job={job}
            onUpdate={onJobUpdate}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
