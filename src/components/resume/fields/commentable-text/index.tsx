import type React from 'react'
import { useCommentProjectionNode } from '../projection'

export function CommentableText({
  nodeKey,
  fieldLabel,
  children,
}: {
  nodeKey: string
  fieldLabel: string
  children?: React.ReactNode
}) {
  const node = useCommentProjectionNode(nodeKey)
  const content = node?.text ?? children

  if (!content) {
    return null
  }

  if (!node) {
    return <>{content}</>
  }

  return (
    <span
      data-comment-node-key={nodeKey}
      data-comment-block-ordinal="0"
      data-comment-field-label={fieldLabel}
    >
      {node.text}
    </span>
  )
}

