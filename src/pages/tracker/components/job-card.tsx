import type { ApplicationStatus, JobApplication } from '../types'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { StatusLine } from './status-line'
import { StatusSelect } from './status-select'

interface JobCardProps {
  job: JobApplication
  onStatusChange?: (jobId: string, status: ApplicationStatus) => void
  onJobClick?: (job: JobApplication) => void
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export function JobCard({ job, onStatusChange, onJobClick, isSelectMode, isSelected, onToggleSelect }: JobCardProps) {
  const handleStatusChange = (newStatus: ApplicationStatus) => {
    if (onStatusChange) {
      onStatusChange(job.id, newStatus)
    }
  }
  const handleClick = () => {
    if (isSelectMode) {
      onToggleSelect?.(job.id) // 选择模式下点击就是选中
    }
    else {
      onJobClick?.(job) // 正常模式打开 Drawer
    }
  }
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all',
        isSelectMode && 'border-2',
        isSelected && 'border-primary bg-primary/5',
      )}
      onClick={handleClick}
    >

      {/* 移动端：flex-col 垂直，桌面端：flex-row 水平 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        {/* Checkbox - 仅选择模式显示 */}
        {isSelectMode && (
          <Checkbox
            checked={isSelected}
            className="size-5"
            onClick={e => e.stopPropagation()}
            onCheckedChange={() => onToggleSelect?.(job.id)}
          />
        )}
        {/* 第一行/左侧：Logo + 职位信息 + Select（始终显示） */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Logo */}
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {job.company_logo
              ? (
                  <img src={job.company_logo} alt={job.company} className="size-6 object-contain" />
                )
              : (
                  <span className="text-sm font-bold">{job.company[0]}</span>
                )}
          </div>

          {/* 职位信息 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{job.position}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {job.company}
              {' '}
              •
              {job.location}
            </p>
          </div>

          {/* 状态选择器 */}
          <StatusSelect value={job.status} onChange={handleStatusChange} />
        </div>

        {/* 第二行/右侧：进度条（移动端独占一行，桌面端在右侧） */}
        <div className="overflow-x-auto" onClick={e => e.stopPropagation()}>
          <StatusLine currentStatus={job.status} onStatusChange={handleStatusChange} />
        </div>
      </div>
    </Card>
  )
}
