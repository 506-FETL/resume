import type React from 'react'
import { useCommentProjectionNode } from '../projection'

export function CommentableText({
  nodeKey,
  fieldLabel,
  children,
  style,
  projection = 'primary',
}: {
  nodeKey: string
  fieldLabel: string
  children?: React.ReactNode
  style?: React.CSSProperties
  projection?: 'primary' | 'display'
}) {
  const node = useCommentProjectionNode(nodeKey)
  const content = node?.text ?? children

  if (!content) {
    return null
  }

  if (!node || projection === 'display') {
    return <span style={style}>{content}</span>
  }

  return (
    <span
      style={style}
      data-comment-node-key={nodeKey}
      data-comment-block-ordinal="0"
      data-comment-field-label={fieldLabel}
    >
      {node.text}
    </span>
  )
}
