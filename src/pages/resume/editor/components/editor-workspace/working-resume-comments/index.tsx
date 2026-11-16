import type { RefObject } from 'react'
import { AnimatePresence } from 'motion/react'
import { CommentBookmark } from '@/features/resume-comments/components/comment-bookmark.tsx'
import { CommentSurface } from '@/features/resume-comments/components/comment-surface.tsx'
import { useResumeCommentStore } from '@/features/resume-comments/context.tsx'
import { useWorkingDocumentCommentSync } from '../../../hooks/use-comment-review-mode'

export function WorkingResumeComments({
  resumeId,
  syncWorkingDocument,
  rootRef,
  sourceLabel,
  currentUserId,
  canCreate,
  canModerateAll,
  open,
  bookmarkVisible,
  onOpenChange,
  layoutRevision,
}: {
  resumeId: string
  syncWorkingDocument: boolean
  rootRef: RefObject<HTMLElement | null>
  sourceLabel: string
  currentUserId: string | null
  canCreate: boolean
  canModerateAll: boolean
  open: boolean
  bookmarkVisible: boolean
  onOpenChange: (open: boolean) => void
  layoutRevision: string
}) {
  useWorkingDocumentCommentSync(resumeId, syncWorkingDocument)

  const hasUnread = useResumeCommentStore((state) =>
    Object.values(state.threadReadStateById).some(
      (thread) =>
        thread.latestCommentEventSeq >
        Math.max(thread.lastReadEventSeq, state.lastReadEventSeq),
    ),
  )

  return (
    <>
      <AnimatePresence initial={false}>
        {!open && bookmarkVisible ? (
          <CommentBookmark
            unread={hasUnread}
            onOpen={() => onOpenChange(true)}
          />
        ) : null}
      </AnimatePresence>
      <CommentSurface
        rootRef={rootRef}
        sourceLabel={sourceLabel}
        permissions={{
          canCreate,
          canModerateAll,
          currentUserId,
        }}
        layoutRevision={layoutRevision}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  )
}
