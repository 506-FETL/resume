import type { RefObject } from 'react'
import type { CommentUiPermissions } from './types.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { compareAnchorOverlap } from '../anchors/selection.ts'
import { useResumeCommentClient, useResumeCommentContext, useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { useCommentSelection } from '../hooks/use-comment-selection.ts'
import { useHighlightGeometry } from '../hooks/use-highlight-geometry.ts'
import { CommentsPanel } from './comments-panel.tsx'
import { HighlightOverlay } from './highlight-overlay.tsx'
import { SelectionAction } from './selection-action.tsx'
import { ThreadPicker } from './thread-picker.tsx'

export function CommentSurface({
  rootRef,
  enabled = true,
  sourceLabel = '当前简历',
  presentation = 'overlay',
  permissions,
  layoutRevision,
  open: controlledOpen,
  onOpenChange,
}: {
  rootRef: RefObject<HTMLElement | null>
  enabled?: boolean
  sourceLabel?: string
  presentation?: 'overlay' | 'docked'
  permissions?: CommentUiPermissions
  layoutRevision?: string | number
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const client = useResumeCommentClient()
  const { store } = useResumeCommentContext()
  const [internalOpen, setInternalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [picker, setPicker] = useState<{ threadIds: string[], point: { x: number, y: number } } | null>(null)
  const open = controlledOpen ?? internalOpen
  const setOpen = useCallback((value: boolean) => {
    if (controlledOpen === undefined)
      setInternalOpen(value)
    onOpenChange?.(value)
    if (!value) {
      setCreating(false)
      store.getState().setActiveThread(null)
      store.getState().setHoveredThread(null)
    }
  }, [controlledOpen, onOpenChange, store])
  const scope = useResumeCommentStore(state => state.scope)
  const selection = useResumeCommentStore(state => state.selection)
  const threads = useResumeCommentStore(useShallow(
    state => state.orderedThreadIds.map(id => state.threadsById[id]).filter(Boolean),
  ))
  const activeThreadId = useResumeCommentStore(state => state.activeThreadId)
  const hoveredThreadId = useResumeCommentStore(state => state.hoveredThreadId)
  const relinkThreadId = useResumeCommentStore(state => state.relinkThreadId)
  const cancelRelink = useResumeCommentStore(state => state.cancelRelink)
  const setRelinkError = useResumeCommentStore(state => state.setRelinkError)
  const setActiveThread = useResumeCommentStore(state => state.setActiveThread)
  const setHoveredThread = useResumeCommentStore(state => state.setHoveredThread)
  const highlightsHidden = useResumeCommentStore(state => state.highlightsHidden)
  const accessState = useResumeCommentStore(state => state.accessState)
  const access = client.getAccessContext()
  const actions = useCommentActions()
  const resolvedPermissions = permissions ?? {
    canCreate: access.kind === 'owner' || (access.kind === 'share' && access.commentsEnabled),
    canModerateAll: access.kind === 'owner',
    currentAnonymousId: access.kind === 'share' ? access.anonymous?.id : null,
  }
  const { clearSelection } = useCommentSelection({
    rootRef,
    documentHash: scope?.documentHash ?? '',
    enabled: enabled && accessState !== 'unavailable',
  })
  const { geometry } = useHighlightGeometry({
    rootRef,
    threads,
    enabled,
    layoutRevision: `${layoutRevision ?? ''}:${scope?.documentRevision ?? 0}`,
  })

  const openThread = useCallback((threadId: string) => {
    setPicker(null)
    setCreating(false)
    setActiveThread(threadId)
    setOpen(true)
  }, [setActiveThread, setOpen])

  const handleSelectionComment = useCallback(async () => {
    if (!selection)
      return
    if (relinkThreadId) {
      const thread = threads.find(item => item.id === relinkThreadId)
      if (!thread) {
        setRelinkError('待关联的评论已不存在')
        return
      }
      const response = await actions.relinkThread(thread)
      if (!response) {
        setRelinkError('重新关联失败，请重新选择文字后再试')
        setActiveThread(thread.id)
        setOpen(true)
        return
      }
      cancelRelink()
      openThread(thread.id)
      return
    }
    const matching = threads.filter(thread => (
      !thread.resolvedAt
      && thread.anchorStatus === 'anchored'
      && compareAnchorOverlap(thread.anchor, selection.anchor) !== 'none'
    ))
    if (matching.length === 1) {
      openThread(matching[0]!.id)
      return
    }
    if (matching.length > 1) {
      const rect = selection.clientRects.at(-1)
      setPicker({
        threadIds: matching.map(thread => thread.id),
        point: { x: rect?.right ?? 12, y: rect?.bottom ?? 12 },
      })
      return
    }
    setActiveThread(null)
    setCreating(true)
    setOpen(true)
  }, [actions, cancelRelink, openThread, relinkThreadId, selection, setActiveThread, setOpen, setRelinkError, threads])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape')
        return
      if (selection) {
        clearSelection()
        return
      }
      if (relinkThreadId) {
        cancelRelink()
        return
      }
      if (picker) {
        setPicker(null)
        return
      }
      if (activeThreadId) {
        setActiveThread(null)
        return
      }
      if (open)
        setOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [activeThreadId, cancelRelink, clearSelection, open, picker, relinkThreadId, selection, setActiveThread, setOpen])

  const pickedThreads = useMemo(() => picker
    ? picker.threadIds.flatMap((id) => {
        const thread = threads.find(item => item.id === id)
        return thread ? [thread] : []
      })
    : [], [picker, threads])

  return (
    <>
      <HighlightOverlay
        rootRef={rootRef}
        geometry={geometry}
        activeThreadId={activeThreadId}
        hoveredThreadId={hoveredThreadId}
        hidden={highlightsHidden}
        onHover={setHoveredThread}
        onPick={(threadIds, point) => {
          if (threadIds.length === 1)
            openThread(threadIds[0]!)
          else
            setPicker({ threadIds, point })
        }}
      />
      {selection
        ? (
            <SelectionAction
              selection={selection}
              disabled={!resolvedPermissions.canCreate || accessState !== 'active'}
              mode={relinkThreadId ? 'relink' : 'comment'}
              onComment={() => handleSelectionComment().catch(() => undefined)}
            />
          )
        : null}
      {picker
        ? (
            <ThreadPicker
              threads={pickedThreads}
              point={picker.point}
              onSelect={openThread}
              onClose={() => setPicker(null)}
            />
          )
        : null}
      <CommentsPanel
        open={open}
        onOpenChange={setOpen}
        presentation={presentation}
        sourceLabel={sourceLabel}
        permissions={resolvedPermissions}
        creating={creating}
        onCancelCreating={() => {
          setCreating(false)
          setOpen(false)
        }}
      />
    </>
  )
}
