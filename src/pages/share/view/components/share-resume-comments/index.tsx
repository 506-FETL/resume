import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { CommentBookmark } from '@/features/resume-comments/components/comment-bookmark'
import { CommentSurface } from '@/features/resume-comments/components/comment-surface'
import { useResumeCommentStore } from '@/features/resume-comments/context'

export default function ShareResumeComments({
  rootRef,
  sourceLabel,
  allowComments,
  currentUserId,
  open,
  onOpenChange,
  layoutRevision,
  documentRevision,
}: {
  rootRef: RefObject<HTMLElement | null>
  sourceLabel: string
  allowComments: boolean
  currentUserId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  layoutRevision: string
  documentRevision: number
}) {
  const hasUnread = useResumeCommentStore((state) =>
    Object.values(state.threadReadStateById).some(
      (thread) =>
        thread.latestCommentEventSeq >
        Math.max(thread.lastReadEventSeq, state.lastReadEventSeq),
    ),
  )
  const selection = useResumeCommentStore((state) => state.selection)
  const setSelection = useResumeCommentStore((state) => state.setSelection)
  const setContentNotice = useResumeCommentStore(
    (state) => state.setContentNotice,
  )
  const previousRevision = useRef(documentRevision)
  useEffect(() => {
    if (previousRevision.current === documentRevision) return
    previousRevision.current = documentRevision
    if (!selection) return
    setSelection(null)
    setContentNotice(
      '简历内容已更新，请重新选择文字后发送。已输入的评论草稿仍然保留。',
    )
  }, [documentRevision, selection, setContentNotice, setSelection])
  return (
    <>
      {!open ? (
        <CommentBookmark unread={hasUnread} onOpen={() => onOpenChange(true)} />
      ) : null}
      <CommentSurface
        rootRef={rootRef}
        sourceLabel={sourceLabel}
        permissions={{
          canCreate: allowComments,
          canModerateAll: false,
          currentUserId,
        }}
        layoutRevision={layoutRevision}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  )
}
