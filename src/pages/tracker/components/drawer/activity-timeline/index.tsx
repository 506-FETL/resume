import type { JobApplication, TrackerActivity, TrackerActivityType } from '../../../types'
import dayjs from 'dayjs'
import { CircleDot, GitCommitHorizontal, MessageSquarePlus, Plus, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { updateCompany } from '@/lib/supabase/resume'
import { cn } from '@/lib/utils'
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
  const { syncJob } = useTrackerStore()
  const reduce = useReducedMotion()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // 最新在上
  const sorted = [...job.activities].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const persist = async (activities: TrackerActivity[], successText: string) => {
    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, { activities })
      syncJob(savedJob)
      toast.success(successText)
    }
    catch (error) {
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
    await persist([...job.activities, activity], '已添加记录')
    setDraft('')
  }

  const handleDelete = async () => {
    const deleteId = pendingDeleteId
    if (!deleteId || saving)
      return

    setPendingDeleteId(null)
    await persist(job.activities.filter(activity => activity.id !== deleteId), '已删除记录')
  }

  const pendingDeleteActivity = job.activities.find(activity => activity.id === pendingDeleteId)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">跟进记录</h3>
        <span className="text-xs text-muted-foreground">
          {job.activities.length}
          {' '}
          条
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="记一条进展，例如：电话沟通、发了跟进邮件…"
          className="flex-1"
          disabled={saving}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing)
              handleAdd()
          }}
        />
        <Button size="sm" className="h-9 shrink-0" disabled={!draft.trim() || saving} onClick={handleAdd}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>

      {sorted.length === 0
        ? (
            <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              还没有跟进记录。推进状态会自动记录，也可以手动补充。
            </p>
          )
        : (
            <ol className="flex flex-col gap-0.5">
              {sorted.map((activity, index) => {
                const Icon = TYPE_ICON[activity.type] ?? CircleDot
                const isAuto = activity.type === 'status_change'
                return (
                  <motion.li
                    key={activity.id}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03 }}
                    className="group flex gap-3"
                  >
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
                    <div className="flex flex-1 items-start justify-between gap-2 pb-4">
                      <div className="min-w-0">
                        <p className="text-sm leading-snug">{activity.label}</p>
                        {activity.note && <p className="mt-0.5 text-xs text-muted-foreground">{activity.note}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{dayjs(activity.at).format('YYYY-MM-DD HH:mm')}</p>
                      </div>
                      {!isAuto && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="删除记录"
                          disabled={saving}
                          onClick={() => setPendingDeleteId(activity.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          )}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={open => !open && setPendingDeleteId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {`删除后将无法恢复。确定要删除「${pendingDeleteActivity?.label ?? '该记录'}」吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={() => setPendingDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
