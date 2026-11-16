import type { JobApplication, TrackerActivity } from '../../../types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

export function useActivityTimeline(job: JobApplication) {
  const saveJobFields = useTrackerStore((state) => state.saveJobFields)
  const reduce = useReducedMotion()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const [pendingDeleteActivity, setPendingDeleteActivity] =
    useState<TrackerActivity | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)
  const [batchDeleteCount, setBatchDeleteCount] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deletingConfirmedRef = useRef(false)

  // 最新在上
  const sorted = useMemo(
    () =>
      [...job.activities].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    [job.activities],
  )

  const layoutKey = useMemo(
    () =>
      sorted
        .map(
          (activity) =>
            `${activity.id}:${activity.label}:${activity.note ?? ''}`,
        )
        .join('|'),
    [sorted],
  )

  const persist = async (
    update: (activities: TrackerActivity[]) => TrackerActivity[],
    successText: string,
  ) => {
    setSaving(true)

    try {
      await saveJobFields(job.id, (current) => ({
        activities: update(current.activities),
      }))

      toast.success(successText)
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    const text = draft.trim()

    if (!text) return

    const activity: TrackerActivity = {
      id: crypto.randomUUID(),
      type: 'note',
      label: text,
      at: new Date().toISOString(),
    }

    await persist((current) => [...current, activity], '已添加记录')
    setDraft('')
  }

  const handleDelete = async () => {
    const deleteId = pendingDeleteActivity?.id

    if (!deleteId || saving) return

    deletingConfirmedRef.current = true
    setDeleteOpen(false)

    if (editingId === deleteId) setEditingId(null)

    await persist(
      (current) => current.filter((activity) => activity.id !== deleteId),
      '已删除记录',
    )
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

    if (!editingId || saving) return
    if (!text) {
      toast.error('内容不能为空')

      return
    }

    const target = job.activities.find((activity) => activity.id === editingId)

    if (target && target.label === text) {
      cancelEdit()

      return
    }

    const update = (current: TrackerActivity[]) =>
      current.map((activity) =>
        activity.id === editingId ? { ...activity, label: text } : activity,
      )

    await persist(update, '已更新记录')
    cancelEdit()
  }

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

      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })
  }

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === sorted.length
        ? new Set()
        : new Set(sorted.map((a) => a.id)),
    )
  }

  const handleBatchDelete = async () => {
    if (saving || selectedIds.size === 0) return

    deletingConfirmedRef.current = true
    setPendingBatchDelete(false)

    const removed = selectedIds.size

    await persist(
      (current) => current.filter((activity) => !selectedIds.has(activity.id)),
      `已删除 ${removed} 条记录`,
    )

    exitSelectMode()
  }

  const restoreDeleteFocus = (event: Event) => {
    event.preventDefault()

    const target =
      !deletingConfirmedRef.current && deleteTriggerRef.current?.isConnected
        ? deleteTriggerRef.current
        : sectionRef.current

    target?.focus({ preventScroll: true })
  }

  return {
    reduce,
    draft,
    setDraft,
    saving,
    pendingDeleteActivity,
    setPendingDeleteActivity,
    deleteOpen,
    setDeleteOpen,
    editingId,
    editDraft,
    setEditDraft,
    selectMode,
    selectedIds,
    pendingBatchDelete,
    setPendingBatchDelete,
    batchDeleteCount,
    setBatchDeleteCount,
    sectionRef,
    deleteTriggerRef,
    deletingConfirmedRef,
    sorted,
    layoutKey,
    handleAdd,
    handleDelete,
    startEdit,
    cancelEdit,
    handleEditSave,
    enterSelectMode,
    exitSelectMode,
    toggleSelected,
    allSelected,
    toggleSelectAll,
    handleBatchDelete,
    restoreDeleteFocus,
  }
}
