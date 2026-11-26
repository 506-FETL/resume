export { sanitizeDeep } from './snapshot'

export { normalizeTags } from './snapshot'

export { buildResumeSnapshot } from './snapshot'

export { normalizeHistoryVersionListItem } from './versions'

export { normalizeHistoryVersion } from './versions'

export { buildHistoryResumeOption, buildCurrentResume } from './versions'

export { getVersionTitle } from './versions'

export { getVersionSubtitle } from './versions'

export { createMetadataDraft } from './metadata'

export { applyMetadataDraftPatch } from './metadata'

export { toVersionMutationPayload } from './metadata'

export { isMetadataDraftDirty } from './metadata'

export { groupVersionsByDay } from './versions'

export { trimToNull } from './metadata'

export { getDateGroupLabel } from './versions'

export { getCurrentSyncState } from './versions'

export { getOrderedSections } from './snapshot'

export {
  sortObjectKeys,
  stableSerialize,
} from '@/lib/supabase/resume/history/snapshot'

export { areSnapshotsEqual } from './snapshot'

export { getResumeTypeLabel } from './versions'
