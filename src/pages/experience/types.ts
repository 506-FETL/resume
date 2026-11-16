export type ExperienceFilter = 'all' | 'files' | 'paste'

export type ExperienceView = 'grid' | 'list'

export interface ExperienceSourceTarget {
  id: string
  name: string
}

export interface ExperienceLocationState {
  sourceId?: string
  versionId?: string
  blockId?: string
}
