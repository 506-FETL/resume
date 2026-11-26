import type {
  PersistedResumeSnapshot,
  ResumeAppearanceConfig,
} from '@/lib/schema/resume/persisted'
import {
  DEFAULT_RESUME_APPEARANCE,
  normalizeResumeAppearance,
} from '@/lib/schema/resume/persisted'

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
