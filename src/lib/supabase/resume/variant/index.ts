export { fetchVariantTree } from './lineage'

export type { VariantLineage, VariantTreeNode } from './lineage'

export {
  applyVariantChanges,
  cloneResumeAsDraft,
  deleteDraftVariant,
  markVariantFailed,
  markVariantReady,
} from './mutations'
