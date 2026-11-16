import { useWorkspaceDocument } from './use-workspace-document'
import type { ORDERType } from '@/lib/schema'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '@/components/theme-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCollaborationStore } from '@/lib/collaboration'
import useResumeStore from '@/store/resume/form'
import { useResumeCheckStore } from '../../store/checks'
import { focusCheckField } from '../../utils/check-focus'
import {
  useCommentReviewMode,
  usePrepareWorkingCommentWrite,
} from '../../hooks/use-comment-review-mode'
import { useEditPanel } from '../../hooks/use-edit-panel'
import { useScrollToSection } from '../../hooks/use-scroll-to-section'
import { useResumeReviewStore } from '../../review-store'
import { usePreparationUiStore } from '../../preparation-store'

export function useEditorWorkspace(loading: boolean) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const restoreEditPanelRef = useRef(false)
  const restoreEditFocusRef = useRef(false)
  const focusEditPanelRef = useRef(false)
  const editPanelElementRef = useRef<HTMLDivElement | null>(null)
  const editTriggerElementRef = useRef<HTMLButtonElement | null>(null)

  const reviewUiRef = useRef<{
    activeTabId: ORDERType
    panelOpen: boolean
    scrollTop: number
  } | null>(null)

  const { theme } = useTheme()

  const {
    documentRef,
    sourceRef,
    previewScrollRef,
    documentState,
    setDocumentState,
    currentResumeId,
    currentDisplayName,
    getShareSnapshot,
  } = useWorkspaceDocument()

  const editorMode = useResumeStore((state) => state.mode)
  const collaborationRole = useCollaborationStore((state) => state.role)

  const collaborationCommentAccess = useCollaborationStore(
    (state) => state.commentAccess,
  )

  const collaborationRequested =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('collabSession')

  const collaboratorMode =
    collaborationRole === 'guest' ||
    (collaborationRequested && collaborationRole !== 'host')

  const collaboratorCommentContext = useMemo(
    () =>
      collaborationCommentAccess
        ? {
            kind: 'collaborator' as const,
            ...collaborationCommentAccess,
          }
        : null,
    [collaborationCommentAccess],
  )

  const refreshCollaboratorCommentAccess = useCallback(async () => {
    const access = await useCollaborationStore.getState().refreshCommentAccess()

    return { kind: 'collaborator' as const, ...access }
  }, [])

  const activeTabId = useResumeStore((state) => state.activeTabId)
  const order = useResumeStore((state) => state.order)
  const updateActiveTabId = useResumeStore((state) => state.updateActiveTabId)
  const updateOrder = useResumeStore((state) => state.updateOrder)
  const toggleVisibility = useResumeStore((state) => state.toggleVisibility)
  const visibilityState = useResumeStore((state) => state.visibility)

  const fill = theme === 'dark' ? '#0c0a09' : '#fafaf9'
  const stroke = theme === 'dark' ? '#3d3b3b' : '#e7e5e4'

  // 桌面编辑面板开关 + 左导航自动让位（桌面恒为右侧常驻侧栏）
  const { open: panelOpen, setOpen: setPanelOpen } = useEditPanel()

  const closeEditPanel = useCallback(() => {
    const active = document.activeElement

    if (active instanceof HTMLElement) active.blur()

    restoreEditFocusRef.current = true
    setPanelOpen(false)
  }, [setPanelOpen])

  useEffect(() => {
    const panel = editPanelElementRef.current

    if (!panelOpen && restoreEditFocusRef.current) {
      restoreEditFocusRef.current = false
      editTriggerElementRef.current?.focus({ preventScroll: true })

      return
    }

    if (!panelOpen || !panel || !focusEditPanelRef.current) return

    focusEditPanelRef.current = false

    panel
      .querySelector<HTMLButtonElement>('[aria-label="收起编辑栏"]')
      ?.focus({ preventScroll: true })
  }, [panelOpen])

  const prepareCommentWrite = usePrepareWorkingCommentWrite(currentResumeId)

  const commentReview = useCommentReviewMode({
    resumeId: currentResumeId,
    workingLabel: currentDisplayName,
    enabled: commentsOpen,
    collaboratorMode,
    collaboratorAccess: collaboratorCommentContext,
  })

  const setReviewActive = useResumeReviewStore((state) => state.setActive)

  useEffect(() => {
    setReviewActive(!commentReview.isWorking)

    return () => setReviewActive(false)
  }, [commentReview.isWorking, setReviewActive])

  const handleCommentsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setCommentsOpen(nextOpen)

      if (nextOpen) {
        restoreEditPanelRef.current = panelOpen
        setPanelOpen(false)

        if (open) setOpen(false)

        return
      }
      if (restoreEditPanelRef.current && !isMobile && commentReview.isWorking)
        setPanelOpen(true)

      restoreEditPanelRef.current = false
    },
    [commentReview.isWorking, isMobile, open, panelOpen, setPanelOpen],
  )

  const handleMobileEditOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)

      if (nextOpen && commentsOpen) handleCommentsOpenChange(false)
    },
    [commentsOpen, handleCommentsOpenChange],
  )

  const scrollToSection = useScrollToSection(previewScrollRef)
  // 桌面：点 tab 既切换又滚动渲染区到对应章节；移动端走底部抽屉
  const useSidebarMode = !isMobile

  const handleActivateWithScroll = useCallback(
    (id: typeof activeTabId) => {
      updateActiveTabId(id)
      scrollToSection(id)
    },
    [updateActiveTabId, scrollToSection],
  )

  const handleCommentSourceChange = useCallback(
    async (key: Parameters<typeof commentReview.selectSource>[0]) => {
      const enteringReview = commentReview.isWorking && key !== 'working'
      const leavingReview = !commentReview.isWorking && key === 'working'

      if (enteringReview) {
        reviewUiRef.current = {
          activeTabId,
          panelOpen,
          scrollTop: previewScrollRef.current?.scrollTop ?? 0,
        }

        restoreEditPanelRef.current = panelOpen
      }

      const changed = await commentReview.selectSource(key)

      if (!changed) return
      if (key !== 'working') {
        setPanelOpen(false)
        setOpen(false)

        return
      }
      if (leavingReview && reviewUiRef.current) {
        const saved = reviewUiRef.current

        updateActiveTabId(saved.activeTabId)
        restoreEditPanelRef.current = saved.panelOpen

        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            previewScrollRef.current?.scrollTo({ top: saved.scrollTop })
          }),
        )

        reviewUiRef.current = null
      }
    },
    [
      activeTabId,
      commentReview,
      panelOpen,
      previewScrollRef,
      setPanelOpen,
      updateActiveTabId,
    ],
  )

  const handleOpenSortDialog = useCallback(() => {
    setSortDialogOpen(true)
  }, [])

  const editRequest = usePreparationUiStore((state) => state.editRequest)
  const checkRequest = useResumeCheckStore((state) => state.requestVersion)
  const checkTab = useResumeCheckStore((state) => state.tab)
  const handledCheckRequestRef = useRef('')
  const cancelFieldFocusRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (
      !checkRequest ||
      `${currentResumeId}:${checkRequest}` === handledCheckRequestRef.current ||
      loading
    )
      return

    handledCheckRequestRef.current = `${currentResumeId}:${checkRequest}`

    if (!commentReview.isWorking) return

    handleCommentsOpenChange(false)

    if (isMobile) setOpen(true)
    else setPanelOpen(true)
  }, [
    checkRequest,
    currentResumeId,
    loading,
    commentReview.isWorking,
    handleCommentsOpenChange,
    isMobile,
    setPanelOpen,
  ])

  useEffect(() => () => cancelFieldFocusRef.current?.(), [])

  useEffect(() => {
    if (
      !commentReview.isWorking ||
      checkTab !== 'edit' ||
      !(isMobile ? open : panelOpen)
    ) {
      cancelFieldFocusRef.current?.()
      cancelFieldFocusRef.current = null
    }
  }, [checkTab, commentReview.isWorking, isMobile, open, panelOpen])

  useEffect(() => {
    if (
      loading ||
      !currentResumeId ||
      (searchParams.get('prepare') !== '1' &&
        searchParams.get('action') !== 'experience')
    )
      return

    usePreparationUiStore
      .getState()
      .requestEdit(
        currentResumeId,
        searchParams.get('action') === 'experience'
          ? 'work_experience'
          : 'basics',
      )

    const next = new URLSearchParams(searchParams)

    next.delete('prepare')
    next.delete('action')
    setSearchParams(next, { replace: true })
  }, [loading, currentResumeId, searchParams, setSearchParams])

  useEffect(() => {
    if (!editRequest || loading) return

    usePreparationUiStore.getState().clearEditRequest()

    if (editRequest.resumeId !== currentResumeId || !commentReview.isWorking)
      return

    handleCommentsOpenChange(false)
    updateActiveTabId(editRequest.section)
    useResumeStore.getState().setSectionOpen(editRequest.section, true)
    useResumeCheckStore.getState().setTab('edit')

    if (isMobile) setOpen(true)
    else setPanelOpen(true)

    scrollToSection(editRequest.section)
    cancelFieldFocusRef.current?.()

    if (editRequest.target) {
      cancelFieldFocusRef.current = focusCheckField(
        editRequest.target,
        !!reduceMotion,
      )
    }
  }, [
    editRequest,
    loading,
    currentResumeId,
    commentReview.isWorking,
    handleCommentsOpenChange,
    updateActiveTabId,
    isMobile,
    setPanelOpen,
    scrollToSection,
    reduceMotion,
  ])

  return {
    isMobile,
    reduceMotion,
    open,
    sortDialogOpen,
    setSortDialogOpen,
    commentsOpen,
    setCommentsOpen,
    focusEditPanelRef,
    editPanelElementRef,
    editTriggerElementRef,
    documentRef,
    sourceRef,
    previewScrollRef,
    documentState,
    setDocumentState,
    currentResumeId,
    getShareSnapshot,
    editorMode,
    collaborationCommentAccess,
    collaboratorMode,
    collaboratorCommentContext,
    refreshCollaboratorCommentAccess,
    activeTabId,
    order,
    updateActiveTabId,
    updateOrder,
    toggleVisibility,
    visibilityState,
    fill,
    stroke,
    panelOpen,
    setPanelOpen,
    closeEditPanel,
    prepareCommentWrite,
    commentReview,
    handleCommentsOpenChange,
    handleMobileEditOpenChange,
    useSidebarMode,
    handleActivateWithScroll,
    handleCommentSourceChange,
    handleOpenSortDialog,
  }
}
