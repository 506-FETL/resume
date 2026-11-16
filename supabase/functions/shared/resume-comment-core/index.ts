export type {
  LegacyResumeEntryIdInput,
  CommentAnchorDocumentBlock,
  CommentAnchorDocumentNode,
  CommentAnchorDocument,
  CommentAnchorDocumentResult,
  ResumeCommentAnchor,
  ResumeCommentRelocationResult,
  CommentProjectedBlock,
} from './types.ts'

export { stableStringify, createLegacyResumeEntryId } from './identity.ts'

export { sha256Hex } from './hash.ts'

export {
  normalizeCommentText,
  splitCommentGraphemes,
  countCommentGraphemes,
} from './text.ts'

export {
  normalizeCommentRichTextBlock,
  projectCommentRichTextBlocks,
} from './rich-text.ts'

export { buildCommentAnchorDocument } from './document.ts'

export { relocateResumeCommentAnchor } from './relocation.ts'
