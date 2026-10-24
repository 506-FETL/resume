import type { TemplateRef } from '../definition-schema'
import type { ExampleRef } from '../source/types'
import type {
  PersistedResumeSnapshot,
  ResumeTemplateBinding,
} from '@/lib/schema'

export interface CreateTemplateResumeInput {
  template: TemplateRef
  example: ExampleRef
  mode: 'local' | 'cloud'
  displayName: string
  description: string
}

export interface CreationIdentity {
  operationId: string
  ownerId: string | null
}

export interface PreparedResumeCreation extends CreationIdentity {
  resumeId: string
  mode: 'local' | 'cloud'
  displayName: string
  description: string
  snapshot: PersistedResumeSnapshot
}

export interface CreatedTemplateResume {
  templateBinding: ResumeTemplateBinding
  resumeId: string
  mode: 'local' | 'cloud'
  displayName: string
  description: string
  createdAt: string
  updatedAt: string
  type: 'default'
}

export interface ResumeCreationPersistence {
  find: (
    prepared: PreparedResumeCreation,
  ) => Promise<CreatedTemplateResume | null>
  insert: (prepared: PreparedResumeCreation) => Promise<CreatedTemplateResume>
}

export class CreationOutcomeUnknownError extends Error {
  constructor() {
    super('暂时无法确认创建结果，请重试确认；不会重复创建简历')
    this.name = 'CreationOutcomeUnknownError'
  }
}
