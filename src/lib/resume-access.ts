import type { PersistedResumeSnapshot, ResumeListItem, ResumeType } from '@/lib/schema'
import { deleteOfflineResume, getAllOfflineResumes, getOfflineResumeById, isOfflineResumeId, updateOfflineResumeMeta } from '@/lib/offline-resume-manager'
import { ResumeNotFoundError } from '@/lib/resume-id'
import { deleteResume, getAllResumesFromUser, getResumeById, updateResumeConfig } from '@/lib/supabase/resume'
import { getCurrentUser } from '@/lib/supabase/user'

export type ResumeStorage = 'local' | 'cloud'

export interface AccessibleResumeListItem extends ResumeListItem {
  isOffline: boolean
  storage: ResumeStorage
}

export interface AccessibleResumeRecord extends Record<string, unknown> {
  resume_id: string
  display_name?: string
  description?: string
  type: ResumeType
  isOffline: boolean
  storage: ResumeStorage
}

interface ResumeMetaPatch {
  display_name?: string
  description?: string
}

export async function listAccessibleResumes(): Promise<AccessibleResumeListItem[]> {
  const localPromise = getAllOfflineResumes()
  const cloudPromise = getCurrentUser().then(user => user ? getAllResumesFromUser() : [])
  const [cloudResumes, localResumes] = await Promise.all([cloudPromise, localPromise])

  return [
    ...cloudResumes.map(resume => ({
      ...resume,
      isOffline: false,
      storage: 'cloud' as const,
    })),
    ...localResumes.map(resume => ({
      ...resume,
      isOffline: true,
      storage: 'local' as const,
    })),
  ]
}

export async function getAccessibleResumeById(resumeId: string): Promise<AccessibleResumeRecord> {
  if (isOfflineResumeId(resumeId)) {
    const localResume = await getOfflineResumeById(resumeId)
    if (!localResume)
      throw new ResumeNotFoundError()

    const { data, ...metadata } = localResume
    return {
      ...(data as Partial<PersistedResumeSnapshot>),
      ...metadata,
      isOffline: true,
      storage: 'local',
    }
  }

  const cloudResume = await getResumeById(resumeId)
  return {
    ...cloudResume,
    isOffline: false,
    storage: 'cloud',
  } as AccessibleResumeRecord
}

export async function updateAccessibleResumeMeta(resumeId: string, patch: ResumeMetaPatch): Promise<void> {
  if (isOfflineResumeId(resumeId)) {
    const localResume = await getOfflineResumeById(resumeId)
    if (!localResume)
      throw new ResumeNotFoundError()
    await updateOfflineResumeMeta(resumeId, patch)
    return
  }

  await getResumeById(resumeId, 'resume_id')
  await updateResumeConfig(resumeId, patch)
}

export async function deleteAccessibleResume(resumeId: string): Promise<void> {
  if (isOfflineResumeId(resumeId)) {
    const localResume = await getOfflineResumeById(resumeId)
    if (!localResume)
      throw new ResumeNotFoundError()
    await deleteOfflineResume(resumeId)
    return
  }

  await getResumeById(resumeId, 'resume_id')
  await deleteResume(resumeId, 'resume_id')
}
