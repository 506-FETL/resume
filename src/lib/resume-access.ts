import type {
  PersistedResumeSnapshot,
  ResumeListItem,
  ResumeType,
} from '@/lib/schema'
import {
  deleteOfflineResume,
  getOfflineResumeSummaries,
  getOfflineResumeById,
  getOfflineResumeProjection,
  isOfflineResumeId,
  updateOfflineResumeMeta,
} from '@/lib/offline-resume-manager'
import { ResumeNotFoundError } from '@/lib/resume-id'
import {
  deleteResume,
  getResumeSummaries,
  getResumeById,
  updateResumeConfig,
} from '@/lib/supabase/resume'
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

export async function listAccessibleResumes(
  limit?: number,
): Promise<AccessibleResumeListItem[]> {
  const localPromise = getOfflineResumeSummaries(limit)

  const cloudPromise = getCurrentUser().then((user) =>
    user ? getResumeSummaries(limit) : [],
  )

  const [cloudResumes, localResumes] = await Promise.all([
    cloudPromise,
    localPromise,
  ])

  const rows = [
    ...cloudResumes.map((resume) => ({
      ...resume,
      isOffline: false,
      storage: 'cloud' as const,
    })),
    ...localResumes.map((resume) => ({
      ...resume,
      isOffline: true,
      storage: 'local' as const,
    })),
  ]

  return limit === undefined ? rows : rows.slice(0, limit)
}

export async function getAccessibleResumeById(
  resumeId: string,
): Promise<AccessibleResumeRecord> {
  if (isOfflineResumeId(resumeId)) {
    const localResume = await getOfflineResumeById(resumeId)

    if (!localResume) throw new ResumeNotFoundError()

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

export async function getAccessibleResumeMetadata(
  resumeId: string,
): Promise<AccessibleResumeRecord> {
  const selector = 'resume_id,display_name,description,type'
  const local = isOfflineResumeId(resumeId)

  const record = local
    ? await getOfflineResumeProjection(resumeId, [
        'resume_id',
        'display_name',
        'description',
        'type',
      ])
    : await getResumeById(resumeId, selector)

  return {
    ...record,
    isOffline: local,
    storage: local ? 'local' : 'cloud',
  } as AccessibleResumeRecord
}

export async function getAccessibleResumeSection(
  resumeId: string,
  sectionKey: (typeof import('@/store/resume').FORM_DATA_KEYS)[number],
): Promise<Record<string, unknown>> {
  if (isOfflineResumeId(resumeId)) {
    return getOfflineResumeProjection(resumeId, [sectionKey])
  }

  return getResumeById(resumeId, sectionKey)
}

export async function updateAccessibleResumeMeta(
  resumeId: string,
  patch: ResumeMetaPatch,
): Promise<void> {
  if (isOfflineResumeId(resumeId)) {
    await getOfflineResumeProjection(resumeId, ['resume_id'])

    await updateOfflineResumeMeta(resumeId, patch)

    return
  }

  await getResumeById(resumeId, 'resume_id')
  await updateResumeConfig(resumeId, patch)
}

export async function deleteAccessibleResume(resumeId: string): Promise<void> {
  if (isOfflineResumeId(resumeId)) {
    await getOfflineResumeProjection(resumeId, ['resume_id'])

    await deleteOfflineResume(resumeId)

    return
  }

  await getResumeById(resumeId, 'resume_id')
  await deleteResume(resumeId, 'resume_id')
}
