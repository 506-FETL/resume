import type { CommentAnchorDocument, CommentAnchorDocumentBlock, CommentAnchorDocumentNode, CommentAnchorDocumentResult } from '../../../../supabase/functions/shared/resume-comment-core.ts'

export type {
  CommentAnchorDocument,
  CommentAnchorDocumentBlock,
  CommentAnchorDocumentNode,
  CommentAnchorDocumentResult,
}

export interface CommentAnchor {
  nodeKey: string
  startGraphemeOffset: number
  endGraphemeOffset: number
  blockOrdinal: number
  exactQuote: string
  prefix: string
  suffix: string
  nodeTextHash: string
  createdAtContentHash: string
}

export interface ResolvedCommentSelection {
  anchor: CommentAnchor
  range: Range
  nodeElement: HTMLElement
  blockElement: HTMLElement
}

export type RelocationResult
  = | { status: 'anchored', anchor: CommentAnchor, moved: boolean, contextChanged: boolean }
    | { status: 'detached', reason: 'node_missing' | 'quote_missing' | 'ambiguous' }

export type AnchorOverlap = 'none' | 'exact' | 'partial' | 'contains' | 'contained_by'
