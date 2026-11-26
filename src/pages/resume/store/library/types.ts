import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../../types'
import type { LibraryQueryCache, ResumeLibraryCounts } from '../library-cache'
import type { ResumeFilterMode } from '../resume-ui'
import type { ResumeListState } from '../types'

export interface ResumeLibrarySlice {
  libraryActive: boolean
  libraryGeneration: number
  libraryAccountId: string | null
  libraryItems: ResumeItem[]
  libraryParents: Record<string, ResumeItem | null>
  libraryParentErrors: Record<string, string>
  loadLibraryParents: (ids: string[]) => Promise<void>
  libraryLoading: boolean
  libraryError: string | null
  libraryHasLoaded: boolean
  libraryCountsLoading: boolean
  libraryCountsError: string | null
  libraryHasNextPage: boolean
  libraryPage: number
  libraryTotal: number | null
  librarySearchCountError: string | null
  libraryAuxiliaryRevision: number
  libraryCounts: ResumeLibraryCounts | null
  librarySearchInput: string
  libraryQuery: string
  libraryOptions: ResumeItem[]
  libraryOptionsLoading: boolean
  libraryOptionsError: string | null
  libraryPendingItems: ResumeItem[]
  libraryPendingLoading: boolean
  libraryPendingError: string | null
  libraryOfflineLoading: boolean
  libraryOfflineError: string | null
  loadLibraryPage: (page?: number) => Promise<void>
  loadLibraryCounts: () => Promise<void>
  refreshLibrary: () => Promise<void>
  invalidateLibrary: () => Promise<void>
  invalidateLibraryUpdate: (id: string, updatedAt?: string) => Promise<void>
  cancelLibraryLoad: () => void
  resetLibraryAccount: (accountId: string | null) => void
  setLibraryFilter: (filter: ResumeFilterMode) => void
  setLibrarySearchInput: (value: string) => void
  setLibraryQuery: (value: string) => Promise<void>
  loadLibraryOptions: (force?: boolean) => Promise<void>
  loadLibraryPendingItems: (force?: boolean) => Promise<void>
  loadLibraryOfflineOptions: (force?: boolean) => Promise<void>
}

export type LibrarySet = StoreApi<ResumeListState>['setState']

export type LibraryGet = StoreApi<ResumeListState>['getState']

export interface LibraryRuntime {
  requestId: number
  revision: number
  queries: Map<string, LibraryQueryCache>
  parentRequests: Map<string, Promise<void>>
  optionsLoaded: boolean
  pendingLoaded: boolean
  optionsRequest: number
  pendingRequest: number
  offlineLoaded: boolean
  offlineRequest: number
  countsRequest: Promise<void> | null
}
