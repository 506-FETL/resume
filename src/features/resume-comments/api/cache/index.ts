export {
  deleteCommentCache,
  deleteCommentCacheForPrincipal,
  readCommentCache,
  writeCommentCache,
} from './bootstrap'

export {
  captureCommentCacheWriteFence,
  isCommentCacheWriteFenceCurrent,
} from './database'

export {
  deriveCommentCacheKey,
  readCommentVersionHint,
  rememberCommentVersionHint,
  serializeCommentCacheKey,
} from './keys'

export {
  pruneCommentThreadReadCursors,
  readCommentReadCursor,
  readCommentThreadReadCursors,
} from './local-cursors'

export {
  advanceCommentReadCursor,
  isCommentCacheEntryCompatible,
  mergeCachedThreadReadStates,
} from './read-state'

export type {
  CachedCommentBootstrap,
  CommentCacheEntry,
  CommentCacheKey,
  CommentCacheWriteFence,
} from './types'

export {
  updateCommentCacheReadCursor,
  updateCommentCacheThreadReadCursor,
} from './update-cursors'
