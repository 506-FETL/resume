export type ExperienceFilter = 'all' | 'files' | 'paste'

export type ExperienceView = 'grid' | 'list'

export interface ExperienceLocationState {
  sourceId?: string
  versionId?: string
  blockId?: string
}
