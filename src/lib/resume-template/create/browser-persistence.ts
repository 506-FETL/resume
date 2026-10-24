import type { ResumeCreationPersistence } from './types'
import {
  createOfflineResumeFromSnapshot,
  getOfflineResumeById,
} from '@/lib/offline-resume-manager'
import {
  createResumeFromSnapshot,
  findPreparedCloudResume,
} from '@/lib/supabase/resume/form'
import { createdResumeResult } from './prepare'

export const browserResumePersistence: ResumeCreationPersistence = {
  async find(prepared) {
    const record =
      prepared.mode === 'local'
        ? await getOfflineResumeById(prepared.resumeId)
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
