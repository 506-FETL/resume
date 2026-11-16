import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import { resolveDefaultTemplateBinding } from '@/lib/resume-template/runtime/default-selection'
import type {
  PersistedResumeSnapshot,
  ResumeAppearanceConfig,
} from '@/lib/schema'
import {
  DEFAULT_RESUME_APPEARANCE,
  normalizeResumeAppearance,
} from '@/lib/schema'
import type { IDBPDatabase } from 'idb'
import type { OfflineResumeRecord, ResumeDB } from './database'

export const LEGACY_STORAGE_KEY = 'resume-config-storage'

export function hasPersistedAppearance(
  data: unknown,
): data is Partial<ResumeAppearanceConfig> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }

  const record = data as Record<string, unknown>

  return (
    record.spacing !== undefined ||
    record.font !== undefined ||
    record.theme !== undefined
  )
}

export function readLegacyLocalAppearance(): ResumeAppearanceConfig | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)

    return normalizeResumeAppearance(parsed?.state)
  } catch {
    return null
  }
}

export function hydrateOfflineResumeData(
  data: Partial<PersistedResumeSnapshot> | undefined,
): Partial<PersistedResumeSnapshot> {
  if (hasPersistedAppearance(data)) {
    return data
  }

  const appearance = readLegacyLocalAppearance() ?? DEFAULT_RESUME_APPEARANCE

  return {
    ...(data ?? {}),
    ...appearance,
  }
}

export async function hydrateOfflineResumeRecord(
  db: IDBPDatabase<ResumeDB>,
  resume: OfflineResumeRecord | undefined,
): Promise<OfflineResumeRecord | undefined> {
  if (!resume) {
    return resume
  }

  if (
    hasPersistedAppearance(resume.data) &&
    readResumeListTemplateBinding(resume.data?.templateBinding)
  ) {
    return resume
  }

  // 网络等待发生在事务之外；随后重读，防止覆盖其他标签页刚保存的正文或模板。
  const binding = await resolveDefaultTemplateBinding(
    resume.data?.templateBinding,
  )

  const tx = db.transaction('resumes', 'readwrite')
  const latest = await tx.store.get(resume.resume_id)

  if (!latest) {
    await tx.done

    return undefined
  }

  const nextResume = {
    ...latest,
    data: {
      ...hydrateOfflineResumeData(latest.data),
      templateBinding:
        readResumeListTemplateBinding(latest.data?.templateBinding) ?? binding,
    },
  }

  await tx.store.put(nextResume)
  await tx.done

  return nextResume
}
