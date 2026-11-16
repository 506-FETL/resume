import type { ResumeLoadResult } from '@/store/resume/helpers/sync-service'
import { CollaborationOperationError } from '@/lib/collaboration'
import { DEFAULT_RESUME_APPEARANCE } from '@/lib/schema'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'

export function hydrateLoadedAppearance(
  result: ResumeLoadResult,
  options: { collaborationSource: boolean },
) {
  const { snapshot, hasPersistedAppearance, cloudAppearanceStatus, mode } =
    result

  const configStore = useResumeConfigStore.getState()

  if (
    options.collaborationSource ||
    mode !== 'online' ||
    hasPersistedAppearance ||
    cloudAppearanceStatus === 'error'
  ) {
    configStore.hydrateFromSnapshot(snapshot)

    return
  }

  const legacyConfig = configStore.readLegacyLocalConfig()
  const fallbackAppearance = legacyConfig ?? DEFAULT_RESUME_APPEARANCE

  configStore.replaceConfig(fallbackAppearance)
  useResumeStore.getState().updateAppearanceConfig(fallbackAppearance)
}

export function isOwnerMustHostError(error: unknown) {
  return (
    error instanceof CollaborationOperationError &&
    error.code === 'owner_must_host'
  )
}
