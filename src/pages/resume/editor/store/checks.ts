import type { CheckSeverity, ResumeCheckIssue } from '@/lib/resume-checks/types'
import type { PreparationRecord } from '@/lib/resume-preparation/types'
import { create } from 'zustand'

export type CheckFilter = 'all' | CheckSeverity | 'resolved'

export type ProofreadStatus = 'idle' | 'running' | 'ready' | 'stale' | 'error'

interface ResumeCheckState {
  identity: string | null
  resumeId: string | null
  ownerId: string | null
  snapshotSignature: string
  issues: ResumeCheckIssue[]
  aiCount: number
  record: PreparationRecord | null
  ruleStatus: 'checking' | 'ready' | 'error'
  ruleError: string | null
  sourceStatus: 'loading' | 'ready' | 'error'
  sourceError: string | null
  proofreadStatus: ProofreadStatus
  proofreadError: string | null
  proofreadSignature: string
  proofreadIssues: ResumeCheckIssue[]
  layoutIssues: ResumeCheckIssue[]
  layoutSnapshotSignature: string
  canUndo: boolean
  busy: boolean
  revision: number
  tab: 'edit' | 'checks'
  filter: CheckFilter
  selectedIssueId: string | null
  selectedTargetIndex: number
  locationMessage: string | null
  locationVersion: number
  requestVersion: number
  reset: (identity: string, resumeId: string, ownerId: string | null) => void
  requestChecks: (filter?: CheckFilter, issueId?: string) => void
  setTab: (tab: 'edit' | 'checks') => void
  setFilter: (filter: CheckFilter) => void
  locate: (issueId: string, targetIndex?: number) => void
}

const initial = {
  identity: null,
  resumeId: null,
  ownerId: null,
  snapshotSignature: '',
  issues: [],
  aiCount: 0,
  record: null,
  ruleStatus: 'checking' as const,
  ruleError: null,
  sourceStatus: 'loading' as const,
  sourceError: null,
  proofreadStatus: 'idle' as const,
  proofreadError: null,
  proofreadSignature: '',
  proofreadIssues: [],
  layoutIssues: [],
  layoutSnapshotSignature: '',
  canUndo: false,
  busy: false,
  revision: 0,
  tab: 'edit' as const,
  filter: 'all' as const,
  selectedIssueId: null,
  selectedTargetIndex: 0,
  locationMessage: null,
  locationVersion: 0,
  requestVersion: 0,
}

function focusTab(tab: 'edit' | 'checks') {
  if (typeof document === 'undefined') return

  const trigger = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-check-mode="${tab}"]`),
  ).find((element) => element.getClientRects().length > 0)

  trigger?.focus({ preventScroll: true })
}

export const useResumeCheckStore = create<ResumeCheckState>((set) => ({
  ...initial,
  reset: (identity, resumeId, ownerId) =>
    set({ ...initial, identity, resumeId, ownerId }),
  requestChecks: (filter = 'all', issueId) => {
    focusTab('checks')

    set((state) => ({
      tab: 'checks',
      filter,
      selectedIssueId: issueId ?? state.selectedIssueId,
      selectedTargetIndex: 0,
      locationVersion: issueId
        ? state.locationVersion + 1
        : state.locationVersion,
      requestVersion: state.requestVersion + 1,
    }))
  },
  setTab: (tab) => {
    focusTab(tab)
    set({ tab })
  },
  setFilter: (filter) => set({ filter }),
  locate: (selectedIssueId, selectedTargetIndex = 0) =>
    set((state) => ({
      selectedIssueId,
      selectedTargetIndex,
      locationMessage: null,
      locationVersion: state.locationVersion + 1,
    })),
}))
