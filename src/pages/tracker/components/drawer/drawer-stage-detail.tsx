import type { ApplicationStatus, JobApplication, StageDetail, StageStatus } from '../../types'
import { Calendar } from 'lucide-react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STAGE_STATUS_OPTIONS } from '../../const'

interface DrawerStageDetailProps {
  job: JobApplication
  onUpdate?: (job: JobApplication) => void
}

export function DrawerStageDetail({ job, onUpdate }: DrawerStageDetailProps) {
  // 从 stage_details 数组中找到当前状态的详情
  const currentStageDetail = job.stage_details.find(s => s.stage === job.status)

  const handleStatusChange = (newStatus: StageStatus) => {
    const updatedDetails = job.stage_details.map(s =>
      s.stage === job.status ? { ...s, status: newStatus } : s,
    )
    onUpdate?.({ ...job, stage_details: updatedDetails })
  }

  const handleNotesChange = (notes: string) => {
    const updatedDetails = job.stage_details.map(s =>
      s.stage === job.status ? { ...s, notes } : s,
    )
    onUpdate?.({ ...job, stage_details: updatedDetails })
  }

  const handleDateChange = (date: string) => {
    const updatedDetails = job.stage_details.map(s =>
      s.stage === job.status ? { ...s, start_date: date } : s,
    )
    onUpdate?.({ ...job, stage_details: updatedDetails })
  }

  return (
    <div className="py-4 space-y-4">
      {/* 标题 + 状态 Badge */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold capitalize">{job.status}</h3>
        <Select
          value={currentStageDetail?.status || '待处理'}
          onValueChange={v => handleStatusChange(v as StageStatus)}
        >
          <SelectTrigger className="w-24 h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* 开始时间 */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">开始时间</label>
        <div className="relative">
          <Input
            type="date"
            className="pl-9"
            value={currentStageDetail?.start_date || ''}
            onChange={e => handleDateChange(e.target.value)}
          />
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        </div>
      </div>
      {/* 面经笔记 采用tiptap富文本编辑器 */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">面经笔记</label>
        <SimpleEditor
          content={currentStageDetail?.notes || ''}
          onChange={editor => handleNotesChange(editor.getHTML())}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        点击进度条上的圆点可以切换到其他阶段
      </p>
    </div>
  )
}
