import type { DocumentSlice } from './types'

export const documentDefaults: Pick<
  DocumentSlice,
  | 'mode'
  | 'currentResumeId'
  | 'documentDisplayName'
  | 'docManager'
  | 'docHandle'
  | 'cleanupFns'
  | 'isInitialized'
  | 'cloudAppearanceStatus'
  | 'docHasPersistedAppearance'
  | 'appearanceDirty'
  | 'entryIdMigrationReady'
  | 'documentChangeRevision'
  | 'documentSessionId'
> = {
  mode: null,
  currentResumeId: null,
  documentDisplayName: null,
  docManager: null,
  docHandle: null,
  cleanupFns: [],
  isInitialized: false,
  cloudAppearanceStatus: 'not_applicable',
  docHasPersistedAppearance: false,
  appearanceDirty: false,
  entryIdMigrationReady: false,
  documentChangeRevision: 0,
  documentSessionId: 0,
}

export class ResumeLoadSupersededError extends Error {
  constructor() {
    super('简历加载已被新的请求替代')
    this.name = 'ResumeLoadSupersededError'
  }
}
