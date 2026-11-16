import type { ResumeComment } from '../../types.ts'

export interface CommentTreeNode {
  comment: ResumeComment
  children: CommentTreeNode[]
}

export interface CommentReplyTarget {
  commentId: string
  displayName: string
}

export function buildCommentTree(comments: ResumeComment[]) {
  const nodes = new Map<string, CommentTreeNode>(
    comments.map((comment) => [comment.id, { comment, children: [] }]),
  )

  const roots: CommentTreeNode[] = []

  for (const comment of comments) {
    const node = nodes.get(comment.id)!
    const parent = comment.parentId ? nodes.get(comment.parentId) : null

    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return { nodes, roots }
}

export function countDescendants(node: CommentTreeNode): number {
  return node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  )
}

export function formatTime(value: string) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(timestamp)
    : ''
}
