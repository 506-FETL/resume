export { fetchOfflineVariantTree } from './lineage'

export {
  clearAllOfflineResumes,
  createOfflineResumeFromSnapshot,
  deleteOfflineResume,
  updateOfflineResume,
  updateOfflineResumeMeta,
} from './mutations'

export {
  getAllOfflineResumes,
  getOfflineResumeById,
  getOfflineResumeLibraryIndex,
  getOfflineResumeProjection,
  getOfflineResumeSummaries,
  getOfflineResumeSummariesByIds,
  isOfflineResumeId,
} from './queries'

export type { OfflineResumeLibraryIndex } from './queries'

export {
  exportOfflineResume,
  importOfflineResume,
  migrateOfflineResumesToCloud,
} from './transfer'

export {
  applyOfflineVariantChanges,
  cloneOfflineResumeAsDraft,
  deleteOfflineDraftVariant,
  markOfflineVariantFailed,
  markOfflineVariantReady,
  setVariantFieldsOffline,
} from './variants'
