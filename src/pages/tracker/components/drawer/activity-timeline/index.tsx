import type { JobApplication, TrackerActivity, TrackerActivityType } from '../../../types'
import dayjs from 'dayjs'
import { Check, CircleDot, GitCommitHorizontal, ListChecks, MessageSquarePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceListItem } from '@/components/motion/presence-item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

const TYPE_ICON: Record<TrackerActivityType, typeof CircleDot> = {
  status_change: GitCommitHorizontal,
  interview: CircleDot,
  follow_up: CircleDot,
  note: MessageSquarePlus,
}

interface ActivityTimelineProps {
  job: JobApplication
}

export default function ActivityTimeline({ job }: ActivityTimelineProps) {
  const saveJobFields = useTrackerStore(state => state.saveJobFields)
  const reduce = useReducedMotion()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)

  // 最新在上
  const sorted = useMemo(() => [...job.activities].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [job.activities])
  const layoutKey = useMemo(() => sorted.map(activity => `${activity.id}:${activity.label}:${activity.note ?? ''}`).join('|'), [sorted])

  const persist = async (update: (activities: TrackerActivity[]) => TrackerActivity[], successText: string) => {
    setSaving(true)
    try {
      await saveJobFields(job.id, current => ({ activities: update(current.activities) }))
      toast.success(successText)
    }
    catch (error) {
      if (isTrackerAccountScopeError(error))
        return
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    const text = draft.trim()
    if (!text)
      return
    const activity: TrackerActivity = {
      id: crypto.randomUUID(),
      type: 'note',
      label: text,
      at: new Date().toISOString(),
    }
    await persist(current => [...current, activity], '已添加记录')
    setDraft('')
  }

  const handleDelete = async () => {
    const deleteId = pendingDeleteId
    if (!deleteId || saving)
      return

    setPendingDeleteId(null)
    if (editingId === deleteId)
      setEditingId(null)
    await persist(current => current.filter(activity => activity.id !== deleteId), '已删除记录')
  }

  const startEdit = (activity: TrackerActivity) => {
    setEditingId(activity.id)
    setEditDraft(activity.label)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const handleEditSave = async () => {
    const text = editDraft.trim()
    if (!editingId || saving)
      return
    if (!text) {
      toast.error('内容不能为空')
      return
    }
    const target = job.activities.find(activity => activity.id === editingId)
    if (target && target.label === text) {
      cancelEdit()
      return
    }
    const update = (current: TrackerActivity[]) => current.map(activity =>
      activity.id === editingId ? { ...activity, label: text } : activity,
    )
    await persist(update, '已更新记录')
    cancelEdit()
  }

  const pendingDeleteActivity = job.activities.find(activity => activity.id === pendingDeleteId)

  const enterSelectMode = () => {
    cancelEdit()
    setSelectMode(true)
    setSelectedIds(new Set())
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id))
        next.delete(id)
      else
        next.add(id)
      return next
    })
  }

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length

  const toggleSelectAll = () => {
    setSelectedIds(prev => (prev.size === sorted.length ? new Set() : new Set(sorted.map(a => a.id))))
  }

  const handleBatchDelete = async () => {
    if (saving || selectedIds.size === 0)
      return
    setPendingBatchDelete(false)
    const removed = selectedIds.size
    await persist(
      current => current.filter(activity => !selectedIds.has(activity.id)),
      `已删除 ${removed} 条记录`,
    )
    exitSelectMode()
  }

  return (
    <section aria-label="跟进记录" className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden [@media(max-height:640px)]:overflow-visible">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">跟进记录</h3>
          <span className="text-xs text-muted-foreground">
            {job.activities.length}
            {' '}
            条
          </span>
        </div>
        {sorted.length > 0 && (
          selectMode
            ? (
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      disabled={saving}
                      onCheckedChange={toggleSelectAll}
                      aria-label="全选"
                    />
                    全选
                  </label>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={exitSelectMode}>
                    退出
                  </Button>
                </div>
              )
            : (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" disabled={saving} onClick={enterSelectMode}>
                  <ListChecks className="size-3.5" />
                  批量
                </Button>
              )
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <Input
          value={draft}
          placeholder="记一条进展"
          className="min-w-0 flex-1"
          disabled={saving || selectMode}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing)
              handleAdd()
          }}
        />
        <Button size="sm" className="h-9 shrink-0" disabled={!draft.trim() || saving || selectMode} onClick={handleAdd}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>

      <div role="region" aria-label="跟进记录列表" tabIndex={0} className="scrollbar-thin-subtle flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [@media(max-height:640px)]:overflow-visible">
        <AnimatedContent animationKey={sorted.length === 0 ? 'empty' : 'activities'} className="flex shrink-0 grow flex-col">
          {sorted.length === 0
            ? (
                <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                  暂无跟进记录
                </p>
              )
            : (
                <ol aria-label="跟进时间线" className="relative flex flex-col gap-0.5 px-1 pr-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {sorted.map((activity, index) => {
                      const Icon = TYPE_ICON[activity.type] ?? CircleDot
                      const isAuto = activity.type === 'status_change'
                      const isChecked = selectedIds.has(activity.id)
                      return (
                        <PresenceListItem
                          key={activity.id}
                          layout={reduce ? false : 'position'}
                          layoutDependency={`${layoutKey}-${selectMode}-${editingId}`}
                          initial={reduce ? false : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, transition: { duration: reduce ? 0 : DURATION.fast, delay: 0, ease: EASE.in } }}
                          transition={reduce ? { duration: 0 } : { duration: DURATION.base, delay: Math.min(index, 8) * 0.03, ease: EASE.out, layout: SPRING.layout }}
                          className={cn(
                            'group flex gap-3',
                            selectMode && 'cursor-pointer rounded-md -mx-1 px-1 hover:bg-muted/40',
                          )}
                          onClick={selectMode && !saving ? () => toggleSelected(activity.id) : undefined}
                        >
                          {selectMode && (
                            <div className="flex h-8 shrink-0 items-center self-start">
                              <Checkbox
                                checked={isChecked}
                                disabled={saving}
                                aria-label={`选择记录：${activity.label}`}
                                onClick={event => event.stopPropagation()}
                                onCheckedChange={() => toggleSelected(activity.id)}
                              />
                            </div>
                          )}
                          <div className="flex flex-col items-center">
                            <span className={cn(
                              'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border',
                              isAuto ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground',
                            )}
                            >
                              <Icon className="size-3" />
                            </span>
                            <span className="w-px flex-1 bg-border group-last:hidden" />
                          </div>
                          <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pb-4">
                            {editingId === activity.id && !selectMode
                              ? (
                                  <div className="flex flex-1 items-center gap-2">
                                    <Input
                                      autoFocus
                                      value={editDraft}
                                      className="h-8"
                                      disabled={saving}
                                      onChange={e => setEditDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                                          handleEditSave()
                                        else if (e.key === 'Escape')
                                          cancelEdit()
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="保存修改"
                                      disabled={saving || !editDraft.trim()}
                                      onClick={handleEditSave}
                                    >
                                      <Check className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="取消编辑"
                                      disabled={saving}
                                      onClick={cancelEdit}
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  </div>
                                )
                              : (
                                  <>
                                    <div className="min-w-0">
                                      <p className="text-sm leading-snug break-words">{activity.label}</p>
                                      {activity.note && <p className="mt-0.5 text-xs text-muted-foreground break-words">{activity.note}</p>}
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">{dayjs(activity.at).format('YYYY-MM-DD HH:mm')}</p>
                                    </div>
                                    {!selectMode && (
                                      <div className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 md:flex">
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label="编辑记录"
                                          disabled={saving}
                                          onClick={() => startEdit(activity)}
                                        >
                                          <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          aria-label="删除记录"
                                          disabled={saving}
                                          onClick={() => setPendingDeleteId(activity.id)}
                                        >
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                )}
                          </div>
                        </PresenceListItem>
                      )
                    })}
                  </AnimatePresence>
                </ol>
              )}
        </AnimatedContent>
      </div>

      {selectMode && (
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm [@media(max-height:640px)]:sticky [@media(max-height:640px)]:bottom-0">
          <span className="text-xs text-muted-foreground">
            已选
            {' '}
            {selectedIds.size}
            {' '}
            条
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8" disabled={saving} onClick={exitSelectMode}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              disabled={saving || selectedIds.size === 0}
              onClick={() => setPendingBatchDelete(true)}
            >
              <Trash2 className="size-3.5" />
              删除所选
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={open => !open && setPendingDeleteId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${pendingDeleteActivity?.label ?? '该记录'}」将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={() => setPendingDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBatchDelete} onOpenChange={open => !open && setPendingBatchDelete(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {`选中的 ${selectedIds.size} 条记录将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={() => setPendingBatchDelete(false)}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleBatchDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
