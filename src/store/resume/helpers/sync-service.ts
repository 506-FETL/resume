import type { StoreApi } from 'zustand'
import type { PersistableResumeState } from '../const'
import type { ResumeState } from '../form'
import type { AutomergeResumeDocument } from '@/lib/automerge'
import type { PersistedResumeSnapshot, ResumeAppearancePatch } from '@/lib/schema'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { isResumeNotFoundError } from '@/lib/resume-id'
import { getResumeById } from '@/lib/supabase/resume/form'
import { getFormPayload, hasPersistedAppearance, mapSourceToPersistedSnapshot, mergeSnapshotAppearance } from '.'
import useResumeConfigStore from '../config'
import { ONLINE_SYNC_DELAY, SYNC_DELAY } from '../const'
import useCurrentResumeStore from '../current'

export type EditorMode = 'online' | 'offline' | null

export interface ResumeLoadResult {
  snapshot: PersistedResumeSnapshot
  hasPersistedAppearance: boolean
  cloudAppearanceStatus: 'present' | 'missing' | 'error' | 'not_applicable'
  mode: Exclude<EditorMode, null>
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let onlineSyncTimer: ReturnType<typeof setTimeout> | null = null

export function clearSyncTimers() {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  if (onlineSyncTimer) {
    clearTimeout(onlineSyncTimer)
    onlineSyncTimer = null
  }
}

export function scheduleOfflinePersist(flushFn: () => Promise<void>) {
  if (syncTimer) {
    clearTimeout(syncTimer)
  }
  syncTimer = setTimeout(() => {
    flushFn()
  }, SYNC_DELAY)
}

export function scheduleOnlinePersist(flushFn: () => Promise<void>) {
  if (onlineSyncTimer) {
    clearTimeout(onlineSyncTimer)
  }
  onlineSyncTimer = setTimeout(() => {
    flushFn()
  }, ONLINE_SYNC_DELAY)
}

export function ensureSection<T extends keyof AutomergeResumeDocument>(doc: AutomergeResumeDocument, key: T) {
  if (!doc[key]) {
    doc[key] = ({} as AutomergeResumeDocument[T])
  }
}

export function applyResumeChange(
  set: StoreApi<ResumeState>['setState'],
  get: StoreApi<ResumeState>['getState'],
  stateUpdate: ((prev: ResumeState) => Partial<ResumeState>) | Partial<ResumeState>,
  docUpdate?: (doc: AutomergeResumeDocument) => void,
) {
  // 1. 应用本地状态更新 (Optimistic UI)
  set((prev: ResumeState) => {
    try {
      const updates = typeof stateUpdate === 'function'
        ? stateUpdate(prev)
        : stateUpdate
      return { ...updates, pendingChanges: true, syncError: null }
    }
    catch (error) {
      console.error('State update failed:', error)
      return { syncError: '状态更新失败' }
    }
  })

  // set() 之后重新读取最新状态，避免使用过期快照
  const freshState = get()
  const resumeId = freshState.currentResumeId ?? useCurrentResumeStore.getState().resumeId

  // 2. 离线模式：触发延时保存
  if (!resumeId || freshState.mode === 'offline' || isOfflineResumeId(resumeId)) {
    scheduleOfflinePersist(() => get().syncToSupabase())
    return
  }

  // 3. 在线模式：更新 Automerge 文档
  if (docUpdate) {
    try {
      freshState.docManager?.change((doc) => {
        docUpdate(doc)
      })
    }
    catch (error) {
      console.error('Document update failed:', error)
      set({ syncError: '文档同步失败，请刷新重试' })
    }
  }

  // 4. 在线模式：调度延时自动保存
  scheduleOnlinePersist(() => get().syncToSupabase())
}

export async function getCloudAppearanceSource(resumeId: string): Promise<{
  status: 'present' | 'missing' | 'error'
  appearance: ResumeAppearancePatch | null
  resumeExists: boolean | null
}> {
  try {
    const appearance = await getResumeById(resumeId, 'spacing,font,theme')
    return {
      status: hasPersistedAppearance(appearance) ? 'present' : 'missing',
      appearance,
      resumeExists: true,
    }
  }
  catch (error) {
    if (!isResumeNotFoundError(error))
      console.warn('Failed to read cloud appearance snapshot:', error)
    return {
      status: 'error',
      appearance: null,
      resumeExists: isResumeNotFoundError(error) ? false : null,
    }
  }
}

export function getPersistedSnapshot(state: PersistableResumeState): PersistedResumeSnapshot {
  const { spacing, font, theme } = useResumeConfigStore.getState()
  return {
    ...getFormPayload(state),
    spacing,
    font,
    theme,
  }
}

export function shouldPersistAppearance(
  state: Pick<ResumeState, 'docHasPersistedAppearance' | 'appearanceDirty' | 'cloudAppearanceStatus'>,
  source: Partial<AutomergeResumeDocument> | null | undefined,
) {
  return hasPersistedAppearance(source)
    || state.docHasPersistedAppearance
    || state.appearanceDirty
    || state.cloudAppearanceStatus === 'present'
    || state.cloudAppearanceStatus === 'missing'
}

export function buildResumeConfigPayload(
  state: PersistableResumeState & Pick<ResumeState, 'docHasPersistedAppearance' | 'appearanceDirty' | 'cloudAppearanceStatus'>,
  source?: Partial<AutomergeResumeDocument> | null,
) {
  const baseSnapshot = source
    ? mapSourceToPersistedSnapshot(source)
    : getPersistedSnapshot(state)

  const snapshot = shouldPersistAppearance(state, source)
    ? mergeSnapshotAppearance(baseSnapshot, useResumeConfigStore.getState())
    : baseSnapshot

  const { templateBinding, ...payload } = snapshot

  if (shouldPersistAppearance(state, source)) {
    return {
      ...payload,
      template_binding: templateBinding,
    }
  }

  const { spacing, font, theme, ...payloadWithoutAppearance } = payload
  return {
    ...payloadWithoutAppearance,
    template_binding: templateBinding,
  }
}
