import type { RefObject } from 'react'
import type { CommentUiPermissions } from './types.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { compareAnchorOverlap } from '../anchors/selection.ts'
import {
  useResumeCommentClient,
  useResumeCommentContext,
  useResumeCommentStore,
} from '../context.tsx'
import { useCommentReadReceipt } from '../hooks/use-comment-realtime.ts'
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
    if (!value)
      setCreating(false)
  }, [controlledOpen, onOpenChange])
  const scope = useResumeCommentStore(state => state.scope)
  const selection = useResumeCommentStore(state => state.selection)
  const threads = useResumeCommentStore(useShallow(
    state => state.orderedThreadIds.map(id => state.threadsById[id]).filter(Boolean),
  ))
  const activeThreadId = useResumeCommentStore(state => state.activeThreadId)
  const setActiveThread = useResumeCommentStore(state => state.setActiveThread)
  const highlightsHidden = useResumeCommentStore(state => state.highlightsHidden)
  const accessState = useResumeCommentStore(state => state.accessState)
  const access = client.getAccessContext()
  const resolvedPermissions = permissions ?? {
    canCreate: access.kind === 'owner' || (access.kind === 'share' && access.commentsEnabled),
    canModerateAll: access.kind === 'owner',
    currentAnonymousId: access.kind === 'share' ? access.anonymous?.id : null,
  }
  const { clearSelection } = useCommentSelection({
    rootRef,
    documentHash: scope?.documentHash ?? '',
    enabled: enabled && accessState !== 'unavailable',
    onInvalidSelection: () => toast.info('请选择同一段落或字段内的文字'),
  })
  const { geometry } = useHighlightGeometry({
    rootRef,
    threads,
    enabled,
    layoutRevision: `${layoutRevision ?? ''}:${scope?.documentRevision ?? 0}`,
  })
  useCommentReadReceipt({ client, store, visible: open })

  const openThread = useCallback((threadId: string) => {
    setPicker(null)
    setCreating(false)
    setActiveThread(threadId)
    setOpen(true)
  }, [setActiveThread, setOpen])

  const handleSelectionComment = useCallback(() => {
    if (!selection)
      return
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
  }, [openThread, selection, setActiveThread, setOpen, threads])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape')
        return
      if (selection) {
        clearSelection()
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
  }, [activeThreadId, clearSelection, open, picker, selection, setActiveThread, setOpen])

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
        hidden={highlightsHidden}
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
              onComment={handleSelectionComment}
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
