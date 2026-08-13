import type { PersistedResumeSnapshot, ResumeAppearanceConfig, ResumeAppearancePatch } from '@/lib/schema'
import { create } from 'zustand'
import { DEFAULT_RESUME_APPEARANCE, mergeResumeAppearance, normalizeResumeAppearance } from '@/lib/schema'
import { LEGACY_RESUME_CONFIG_STORAGE_KEY } from './const'

interface ResumeConfigState {
  spacing: ResumeAppearanceConfig['spacing']
  spacingPreview: ResumeAppearanceConfig['spacing'] | null
  font: ResumeAppearanceConfig['font']
  theme: ResumeAppearanceConfig['theme']

  updateSpacing: (data: Partial<ResumeAppearanceConfig['spacing']>) => void
  beginSpacingPreview: () => void
  updateSpacingPreview: (data: Partial<ResumeAppearanceConfig['spacing']>) => void
  commitSpacingPreview: () => void
  discardSpacingPreview: () => void
  updateFont: (data: Partial<ResumeAppearanceConfig['font']>) => void
  updateTheme: (data: Partial<ResumeAppearanceConfig['theme']>) => void
  replaceConfig: (nextConfig: ResumeAppearancePatch) => void
  resetConfig: () => void
  hydrateFromSnapshot: (snapshot: Partial<PersistedResumeSnapshot> | null | undefined) => void
  readLegacyLocalConfig: () => ResumeAppearanceConfig | null
}

let persistResumeAppearance: ((appearance: ResumeAppearancePatch) => void) | null = null

function applyAppearance(
  set: (updater: (state: ResumeConfigState) => Partial<ResumeConfigState>) => void,
  appearance: ResumeAppearancePatch,
) {
  set(state => ({
    ...mergeResumeAppearance({
      spacing: state.spacing,
      font: state.font,
      theme: state.theme,
    }, appearance),
  }))
}

function readLegacyLocalConfig(): ResumeAppearanceConfig | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  const raw = window.localStorage.getItem(LEGACY_RESUME_CONFIG_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return normalizeResumeAppearance(parsed?.state)
  }
  catch {
    return null
  }
}

const useResumeConfigStore = create<ResumeConfigState>()((set, get) => ({
  ...DEFAULT_RESUME_APPEARANCE,
  spacingPreview: null,

  updateSpacing: (data) => {
    applyAppearance(set, { spacing: data })
    persistResumeAppearance?.({ spacing: data })
  },
  beginSpacingPreview: () => {
    set(state => state.spacingPreview ? {} : { spacingPreview: { ...state.spacing } })
  },
  updateSpacingPreview: (data) => {
    set(state => state.spacingPreview
      ? { spacingPreview: { ...state.spacingPreview, ...data } }
      : {})
  },
  commitSpacingPreview: () => {
    const preview = get().spacingPreview
    if (!preview)
      return

    const spacing = { ...preview }
    set({ spacing, spacingPreview: null })
    persistResumeAppearance?.({ spacing })
  },
  discardSpacingPreview: () => set({ spacingPreview: null }),
  updateFont: (data) => {
    applyAppearance(set, { font: data })
    persistResumeAppearance?.({ font: data })
  },
  updateTheme: (data) => {
    applyAppearance(set, { theme: data })
    persistResumeAppearance?.({ theme: data })
  },
  replaceConfig: nextConfig => applyAppearance(set, nextConfig),
  resetConfig: () => set(() => ({ ...DEFAULT_RESUME_APPEARANCE, spacingPreview: null })),
  hydrateFromSnapshot: snapshot => set(() => ({ ...normalizeResumeAppearance(snapshot), spacingPreview: null })),
  readLegacyLocalConfig,
}))

export function registerResumeConfigPersistence(handler: ((appearance: ResumeAppearancePatch) => void) | null) {
  persistResumeAppearance = handler
}

export default useResumeConfigStore
