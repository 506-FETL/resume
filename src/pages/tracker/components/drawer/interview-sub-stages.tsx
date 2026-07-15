import type { InterviewSubStage, StageStatus } from '../../types'
import dayjs from 'dayjs'
import { CalendarIcon, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { STAGE_STATUS_COLORS, STAGE_STATUS_OPTIONS } from '../../const'

interface InterviewSubStagesProps {
  subStages: InterviewSubStage[]
  currentStatus: string
  saving: boolean
  onAddSubStage: () => void
  onDeleteSubStage: (id: string) => void
  onUpdateSubStage: (id: string, updates: Partial<InterviewSubStage>) => void
}

export function InterviewSubStages({
  subStages,
  currentStatus,
  saving,
  onAddSubStage,
  onDeleteSubStage,
  onUpdateSubStage,
}: InterviewSubStagesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(subStages[0]?.id ?? null)

  // Keep selection valid: pick last when current selection is gone, default to first available
  useEffect(() => {
    if (subStages.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !subStages.some(s => s.id === selectedId)) {
      setSelectedId(subStages[subStages.length - 1].id)
    }
  }, [subStages, selectedId])

  const selected = useMemo(
    () => subStages.find(s => s.id === selectedId) ?? null,
    [subStages, selectedId],
  )

  const canAdd = !saving && currentStatus === '进行中'

  const handleAdd = () => {
    onAddSubStage()
  }

  const renderListItem = (subStage: InterviewSubStage, index: number) => {
    const colors = STAGE_STATUS_COLORS[subStage.status]
    const isActive = subStage.id === selectedId
    const dateLabel = subStage.start_date ? dayjs(subStage.start_date).format('M月D日') : '未排期'
    return (
      <li key={subStage.id}>
        <button
          type="button"
          onClick={() => setSelectedId(subStage.id)}
          className={cn(
            'group w-full rounded-lg border px-3 py-2 text-left transition-all',
            isActive
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
              )}
              >
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium">{subStage.label || `第 ${index + 1} 轮`}</span>
            </div>
            <Badge variant="outline" className={cn('shrink-0 text-[10px]', colors.bg, colors.text, colors.border)}>
              {subStage.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarIcon className="size-3" />
            <span>{dateLabel}</span>
          </div>
        </button>
      </li>
    )
  }

  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="flex h-full min-w-0 min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {subStages.length === 0
              ? '暂无面试轮次，点击下方「添加面试轮次」开始记录'
              : '从左侧选择一轮查看与编辑详情'}
          </p>
        </div>
      )
    }

    const subColors = STAGE_STATUS_COLORS[selected.status]
    const subDate = selected.start_date ? dayjs(selected.start_date).toDate() : undefined
    const showDateAndNotes = selected.status !== '待处理'

    return (
      <div className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Input
            value={selected.label}
            onChange={e => onUpdateSubStage(selected.id, { label: e.target.value })}
            className="h-9 flex-1 text-sm font-medium"
            placeholder="轮次名称"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDeleteSubStage(selected.id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="删除该轮次"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className={cn('grid gap-3', showDateAndNotes ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">本轮状态</span>
            <Select
              value={selected.status}
              onValueChange={value => onUpdateSubStage(selected.id, { status: value as StageStatus })}
            >
              <SelectTrigger className={cn('w-full', subColors.text)}>
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

          {showDateAndNotes && (
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">面试时间</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start font-normal',
                      !subDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {subDate ? dayjs(subDate).format('YYYY-MM-DD') : '选择日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={subDate}
                    onSelect={(date) => {
                      onUpdateSubStage(selected.id, {
                        start_date: date ? dayjs(date).format('YYYY-MM-DD') : null,
                      })
                    }}
                  />
                </PopoverContent>
              </Popover>
            </label>
          )}
        </div>

        {showDateAndNotes && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">面经笔记</span>
            <SimpleEditor
              content={selected.notes || ''}
              onChange={editor => onUpdateSubStage(selected.id, { notes: editor.getHTML() })}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">面试轮次</span>
        <span className="text-xs text-muted-foreground">
          共
          {' '}
          {subStages.length}
          {' '}
          轮
        </span>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        {/* Master list */}
        <div className="flex flex-col gap-2">
          {subStages.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1 sm:max-h-[420px]">
              {subStages.map(renderListItem)}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full"
          >
            <Plus className="size-4" />
            添加面试轮次
          </Button>
          {!canAdd && currentStatus !== '进行中' && (
            <p className="text-[11px] leading-4 text-muted-foreground">
              先把阶段状态改为「进行中」才能新增轮次
            </p>
          )}
        </div>

        {/* Detail */}
        {renderDetail()}
      </div>
    </div>
  )
}
