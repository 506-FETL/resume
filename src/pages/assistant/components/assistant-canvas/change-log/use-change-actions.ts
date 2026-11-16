import { markChangeState, runCanvasWrite } from './writes'
import { recordAppliedAiEvidence } from '@/lib/resume-preparation/evidence'
import useUserStore from '@/store/user'
import type { CanvasChange, CanvasModel } from '../../../types'
import type { FormDataMap } from '@/store/resume'
import { useState } from 'react'
import { toast } from 'sonner'
import { normalizeResumeSection } from '@/lib/schema'
import { getAssistantRun } from '../../../runtime/assistant-run'
import { applyResumeFieldToDocument } from '@/store/resume'
import useAssistantStore from '../../../store'
import { retryToolCall } from '../../../tool-retry'

export function useChangeActions(model: CanvasModel) {
  const bumpCanvasRefresh = useAssistantStore((s) => s.bumpCanvasRefresh)

  const running = useAssistantStore(
    (state) =>
      state.runPhase !== 'idle' ||
      Boolean(state.pendingAssistantWrite) ||
      state.pendingMessageUpdates.length > 0,
  )

  const [localUndone, setLocalUndone] = useState<Map<string, boolean>>(
    () => new Map(),
  )

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingRetryId, setPendingRetryId] = useState<string | null>(null)
  const [undoAllPending, setUndoAllPending] = useState(false)
  const [reapplyPending, setReapplyPending] = useState(false)
  const [retryAllPending, setRetryAllPending] = useState(false)

  const isUndoneItem = (change: CanvasChange): boolean =>
    localUndone.get(change.id) ?? Boolean(change.undone)

  const handleUndo = async (change: CanvasChange) => {
    return runCanvasWrite(async () => {
      const messagesSnapshot = [...useAssistantStore.getState().messages]

      if (!change.undo) return

      const currentId = change.resumeId

      if (!currentId) {
        toast.error('这条修改缺少简历目标，无法撤销')

        return
      }

      setPendingId(change.id)

      try {
        await applyResumeFieldToDocument(
          currentId,
          change.undo.sectionKey as keyof FormDataMap,
          normalizeResumeSection(
            change.undo.sectionKey as keyof FormDataMap,
            change.undo.before,
          ),
        )

        setLocalUndone((prev) => new Map(prev).set(change.id, true))

        const saved = await markChangeState(change.id, true, messagesSnapshot)

        bumpCanvasRefresh()

        if (saved) toast.success('已撤销该修改')
      } catch (error) {
        toast.error('撤销失败', {
          description: error instanceof Error ? error.message : '请稍后重试',
        })
      } finally {
        setPendingId(null)
      }
    }, change.resumeId)
  }

  const handleRedo = async (change: CanvasChange) => {
    return runCanvasWrite(async () => {
      const messagesSnapshot = [...useAssistantStore.getState().messages]

      const detail = change.detail
      const ownerId = useUserStore.getState().currentUser?.id ?? null

      if (!change.undo || detail?.kind !== 'diff') return

      const currentId = change.resumeId

      if (!currentId) {
        toast.error('这条修改缺少简历目标，无法重做')

        return
      }

      setPendingId(change.id)

      try {
        if ((useUserStore.getState().currentUser?.id ?? null) !== ownerId)
          throw new Error('登录账号已改变，请重新确认修改')

        await applyResumeFieldToDocument(
          currentId,
          change.undo.sectionKey as keyof FormDataMap,
          detail.after as Record<string, unknown>,
        )

        await recordAppliedAiEvidence(
          currentId,
          ownerId,
          change.undo.sectionKey as keyof FormDataMap,
          detail.after,
          detail.before,
        )

        setLocalUndone((prev) => new Map(prev).set(change.id, false))

        const saved = await markChangeState(change.id, false, messagesSnapshot)

        bumpCanvasRefresh()

        if (saved) toast.success('已重新应用该修改')
      } catch (error) {
        toast.error('重做失败', {
          description: error instanceof Error ? error.message : '请稍后重试',
        })
      } finally {
        setPendingId(null)
      }
    }, change.resumeId)
  }

  const handleUndoAll = async () => {
    return runCanvasWrite(async () => {
      const messagesSnapshot = [...useAssistantStore.getState().messages]

      setUndoAllPending(true)

      const targets = model.writes
        .filter(
          (c) =>
            c.resumeId && c.undo && c.state === 'result' && !isUndoneItem(c),
        )
        .reverse()

      let successCount = 0

      try {
        for (const change of targets) {
          if (getAssistantRun()?.controller.signal.aborted) break

          try {
            await applyResumeFieldToDocument(
              change.resumeId!,
              change.undo!.sectionKey as keyof FormDataMap,
              normalizeResumeSection(
                change.undo!.sectionKey as keyof FormDataMap,
                change.undo!.before,
              ),
            )

            setLocalUndone((prev) => new Map(prev).set(change.id, true))

            if (await markChangeState(change.id, true, messagesSnapshot))
              successCount++
            else break
          } catch {
            // 跳过单条失败，继续其他
          }
        }

        if (successCount > 0) {
          bumpCanvasRefresh()
          toast.success(`已撤销 ${successCount} 项修改`)
        }
      } finally {
        setUndoAllPending(false)
      }
    })
  }

  const handleReapplyAll = async () => {
    return runCanvasWrite(async () => {
      const messagesSnapshot = [...useAssistantStore.getState().messages]

      setReapplyPending(true)

      const ownerId = useUserStore.getState().currentUser?.id ?? null

      const targets = model.writes.filter(
        (c) =>
          c.resumeId && isUndoneItem(c) && c.undo && c.detail?.kind === 'diff',
      )

      let successCount = 0

      try {
        for (const change of targets) {
          if (getAssistantRun()?.controller.signal.aborted) break

          const detail = change.detail

          if (detail?.kind !== 'diff') continue

          try {
            if ((useUserStore.getState().currentUser?.id ?? null) !== ownerId)
              throw new Error('登录账号已改变，请重新确认修改')

            await applyResumeFieldToDocument(
              change.resumeId!,
              change.undo!.sectionKey as keyof FormDataMap,
              detail.after as Record<string, unknown>,
            )

            await recordAppliedAiEvidence(
              change.resumeId!,
              ownerId,
              change.undo!.sectionKey as keyof FormDataMap,
              detail.after,
              detail.before,
            )

            setLocalUndone((prev) => new Map(prev).set(change.id, false))

            if (await markChangeState(change.id, false, messagesSnapshot))
              successCount++
            else break
          } catch {
            // 跳过单条失败，继续其他
          }
        }

        if (successCount > 0) {
          bumpCanvasRefresh()
          toast.success(`已重新应用 ${successCount} 项修改`)
        }
      } finally {
        setReapplyPending(false)
      }
    })
  }

  const handleRetry = async (change: CanvasChange) => {
    setPendingRetryId(change.id)

    try {
      await retryToolCall(change.id)
    } finally {
      setPendingRetryId(null)
    }
  }

  const handleRetryAll = async () => {
    setRetryAllPending(true)

    const targets = model.writes.filter((c) => c.state === 'error')

    try {
      for (const change of targets) {
        if (!(await retryToolCall(change.id))) break
      }
    } finally {
      setRetryAllPending(false)
    }
  }

  return {
    running,
    pendingId,
    pendingRetryId,
    undoAllPending,
    reapplyPending,
    retryAllPending,
    isUndoneItem,
    handleUndo,
    handleRedo,
    handleUndoAll,
    handleReapplyAll,
    handleRetry,
    handleRetryAll,
  }
}
