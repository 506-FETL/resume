import type { CommentAnchorDocumentNode } from '@/features/resume-comments/anchors/types'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export function buildCommentNodeKey(
  sectionKey: string,
  entryId: string,
  fieldKey: string,
) {
  return `${sectionKey}/${entryId}/${fieldKey}`
}

export function useCommentProjectionNode(
  nodeKey: string,
): CommentAnchorDocumentNode | null {
  const { commentNodesByKey } = useResumeContext()

  return commentNodesByKey.get(nodeKey) ?? null
}
