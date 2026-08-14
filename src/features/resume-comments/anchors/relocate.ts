import type { CommentAnchor, CommentAnchorDocumentNode, RelocationResult } from './types.ts'
import { relocateResumeCommentAnchor } from '../../../../supabase/functions/shared/resume-comment-core.ts'

export function relocateAnchor(
  anchor: CommentAnchor,
  nextNode: CommentAnchorDocumentNode | null | undefined,
): RelocationResult {
  return relocateResumeCommentAnchor(anchor, nextNode)
}
