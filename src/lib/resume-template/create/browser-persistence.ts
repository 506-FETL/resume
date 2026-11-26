import type { ResumeCreationPersistence } from './types'
import { getDB } from '@/lib/offline-resume-manager/database'
import { createOfflineResumeFromSnapshot } from '@/lib/offline-resume-manager/mutations'
import {
  createResumeFromSnapshot,
  findPreparedCloudResume,
} from '@/lib/supabase/resume/create-template'
import { createdResumeResult } from './prepare'

export const browserResumePersistence: ResumeCreationPersistence = {
  async find(prepared) {
    const record =
      prepared.mode === 'local'
        ? await (await getDB()).get('resumes', prepared.resumeId)
        : await findPreparedCloudResume(prepared)

    return record ? createdResumeResult(prepared, record) : null
  },
  async insert(prepared) {
    const record =
      prepared.mode === 'local'
        ? await createOfflineResumeFromSnapshot(prepared)
        : await createResumeFromSnapshot(prepared)

    return createdResumeResult(prepared, record)
  },
}
