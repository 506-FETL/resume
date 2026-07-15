import type { ApplicationStatus, StageStatus } from '../../types'
import dayjs from 'dayjs'
import { CalendarIcon, CheckCircle2 } from 'lucide-react'
import { FormFooter } from '@/components/forms/form-footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG, STAGE_STATUS_COLORS, STAGE_STATUS_OPTIONS } from '../../const'
import { InterviewSubStages } from './interview-sub-stages'
import { useStageDetail } from './use-stage-detail'

interface DrawerStageDetailProps {
  displayStage: ApplicationStatus
  isViewingHistory?: boolean
  onSaved?: () => void
}

export default function DrawerStageDetail({
  displayStage,
  isViewingHistory = false,
  onSaved,
}: DrawerStageDetailProps) {
  const { job, localSubStages, isDirty, saving, isInterviewStatus, currentStatus, selectedDate, handleStatusChange, handleDateChange, addSubStage, deleteSubStage, updateSubStage, handleSave: handleSaveHook, handleCancel, canCompleteStage, markCurrentStageComplete } = useStageDetail({ displayStage })

  if (!job)
    return null

  const stageLabel = APPLICATION_STATUS_CONFIG[displayStage].label
  const colors = STAGE_STATUS_COLORS[currentStatus]

  const handleSave = async () => {
    await handleSaveHook()
    onSaved?.()
  }

  const handleComplete = async () => {
    await markCurrentStageComplete()
    onSaved?.()
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight">{stageLabel}</h3>
          {isViewingHistory && (
            <Badge variant="outline" className="rounded-full text-[10px]">历史</Badge>
          )}
        </div>
        {!isViewingHistory && (
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={!canCompleteStage || saving}
            className="h-8"
          >
            <CheckCircle2 className="size-4" />
            完成本阶段
          </Button>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">阶段状态</span>
          <Select
            value={currentStatus}
            onValueChange={value => handleStatusChange(value as StageStatus)}
            disabled={isViewingHistory}
          >
            <SelectTrigger className={cn('w-full', colors.text)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_STATUS_OPTIONS.map((status) => {
                const c = STAGE_STATUS_COLORS[status]
                return (
                  <SelectItem key={status} value={status}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('size-2 rounded-full border', c.bg, c.border)} />
                      <span className={c.text}>{status}</span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </label>

        {!isInterviewStatus && currentStatus !== '待处理' && (
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">进入时间</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isViewingHistory}
                  className={cn('w-full justify-start font-normal', !selectedDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '选择日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} />
              </PopoverContent>
            </Popover>
          </label>
        )}
      </div>

      {isInterviewStatus && currentStatus !== '待处理' && !isViewingHistory && (
        <InterviewSubStages
          subStages={localSubStages}
          currentStatus={currentStatus}
          saving={saving}
          onAddSubStage={addSubStage}
          onDeleteSubStage={deleteSubStage}
          onUpdateSubStage={updateSubStage}
        />
      )}

      {!isViewingHistory && (
        <p className="text-xs text-muted-foreground">
          提示：把状态改为「已完成」并保存，会自动推进到下一阶段；也可以直接点右上角「完成本阶段」一步推进。
        </p>
      )}

      <FormFooter
        hidden={isViewingHistory}
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </section>
  )
}
