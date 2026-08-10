import type { HistorySelection, PendingDiscardAction, VersionMetadataDraft } from '../../types'
import type { ResumeHistoryVersionRecord } from '@/lib/supabase/resume/history'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useHistoryStore from '../../store'
import { applyMetadataDraftPatch, createMetadataDraft, isMetadataDraftDirty } from '../../utils'

const EMPTY_DRAFT = createMetadataDraft()

export type HistoryDetailTab = 'overview' | 'resume'

export interface HistoryDetailPanelState {
  selectedEntry: HistorySelection
  selectedVersion: ResumeHistoryVersionRecord | null
  editing: boolean
  editDraft: VersionMetadataDraft
  discardDialogOpen: boolean
  activeTab: HistoryDetailTab
  setActiveTab: (tab: HistoryDetailTab) => void
  selectEntry: (target: HistorySelection) => void
  requestSelectEntry: (target: HistorySelection) => void
  requestCloseDetail: () => void
  startEditing: () => void
  cancelEditing: () => void
  updateEditDraft: (patch: Partial<VersionMetadataDraft>) => void
  submitEditDraft: () => Promise<void>
  confirmDiscardChanges: () => void
  cancelDiscardChanges: () => void
}

export function useHistoryDetailPanelState(activeResumeId: string | null): HistoryDetailPanelState {
  const versions = useHistoryStore(state => state.versions)
  const updateVersionMetadata = useHistoryStore(state => state.updateVersionMetadata)

  const [selectedEntry, setSelectedEntry] = useState<HistorySelection>(null)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<VersionMetadataDraft>(EMPTY_DRAFT)
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [pendingDiscardAction, setPendingDiscardAction] = useState<PendingDiscardAction>(null)
  const [activeTab, setActiveTab] = useState<HistoryDetailTab>('resume')

  const selectedVersion = useMemo(
    () => typeof selectedEntry === 'number'
      ? versions.find(version => version.id === selectedEntry) ?? null
      : null,
    [selectedEntry, versions],
  )

  const resetEditingState = useCallback(() => {
    setEditing(false)
    setEditDraft(EMPTY_DRAFT)
  }, [])

  const clearPendingDiscard = useCallback(() => {
    setDiscardDialogOpen(false)
    setPendingDiscardAction(null)
  }, [])

  const selectEntry = useCallback((target: HistorySelection) => {
    setSelectedEntry(target)
    resetEditingState()
    clearPendingDiscard()
  }, [clearPendingDiscard, resetEditingState])

  useEffect(() => {
    selectEntry(null)
  }, [activeResumeId, selectEntry])

  useEffect(() => {
    if (typeof selectedEntry === 'number' && !versions.some(version => version.id === selectedEntry)) {
      selectEntry(null)
    }
  }, [selectedEntry, selectEntry, versions])

  const hasDirtyEditDraft = editing && isMetadataDraftDirty(editDraft, selectedVersion)

  const requestDiscard = useCallback((action: PendingDiscardAction) => {
    if (!hasDirtyEditDraft) {
      return false
    }

    setPendingDiscardAction(action)
    setDiscardDialogOpen(true)
    return true
  }, [hasDirtyEditDraft])

  const requestSelectEntry = useCallback((target: HistorySelection) => {
    if (selectedEntry === target) {
      return
    }

    if (requestDiscard({ type: 'select', target })) {
      return
    }

    selectEntry(target)
  }, [requestDiscard, selectEntry, selectedEntry])

  const requestCloseDetail = useCallback(() => {
    if (requestDiscard({ type: 'close' })) {
      return
    }

    selectEntry(null)
  }, [requestDiscard, selectEntry])

  const startEditing = useCallback(() => {
    if (!selectedVersion) {
      return
    }

    setEditing(true)
    setEditDraft(createMetadataDraft(selectedVersion))
  }, [selectedVersion])

  const cancelEditing = useCallback(() => {
    resetEditingState()
  }, [resetEditingState])

  const updateEditDraft = useCallback((patch: Partial<VersionMetadataDraft>) => {
    setEditDraft(current => applyMetadataDraftPatch(current, patch))
  }, [])

  const submitEditDraft = useCallback(async () => {
    if (!selectedVersion) {
      return
    }

    const updated = await updateVersionMetadata(selectedVersion.id, editDraft)

    if (!updated) {
      return
    }

    resetEditingState()
  }, [editDraft, resetEditingState, selectedVersion, updateVersionMetadata])

  const confirmDiscardChanges = useCallback(() => {
    if (pendingDiscardAction?.type === 'select') {
      selectEntry(pendingDiscardAction.target)
      return
    }

    selectEntry(null)
  }, [pendingDiscardAction, selectEntry])

  const cancelDiscardChanges = useCallback(() => {
    clearPendingDiscard()
  }, [clearPendingDiscard])

  return {
    selectedEntry,
    selectedVersion,
    editing,
    editDraft,
    discardDialogOpen,
    activeTab,
    setActiveTab,
    selectEntry,
    requestSelectEntry,
    requestCloseDetail,
    startEditing,
    cancelEditing,
    updateEditDraft,
    submitEditDraft,
    confirmDiscardChanges,
    cancelDiscardChanges,
  }
}
