export interface LegacyResumeEntryIdInput {
  sectionKey: string
  collectionKey: string
  index: number
  value: unknown
}

export interface CommentAnchorDocumentBlock {
  ordinal: number
  startGraphemeOffset: number
  endGraphemeOffset: number
}

export interface CommentAnchorDocumentNode {
  nodeKey: string
  sectionKey: string
  entryId: string
  fieldKey: string
  text: string
  blocks: CommentAnchorDocumentBlock[]
  nodeTextHash: string
}

export interface CommentAnchorDocument {
  version: 1
  projectionReferenceDate: string
  nodes: CommentAnchorDocumentNode[]
}

export interface CommentAnchorDocumentResult {
  document: CommentAnchorDocument
  documentHash: string
}

export interface ResumeCommentAnchor {
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

export type ResumeCommentRelocationResult =
  | {
      status: 'anchored'
      anchor: ResumeCommentAnchor
      moved: boolean
      contextChanged: boolean
    }
  | {
      status: 'detached'
      reason: 'node_missing' | 'quote_missing' | 'ambiguous'
    }

export interface CommentProjectedBlock {
  text: string
}

export interface ProjectedNodeInput {
  sectionKey: string
  entryId: string
  fieldKey: string
  blocks: CommentProjectedBlock[]
}
