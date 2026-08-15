import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { ORDERType } from '@/lib/schema'
import { Edit } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { CommentBookmark } from '@/features/resume-comments/components/comment-bookmark.tsx'
import { CommentSourceSelector } from '@/features/resume-comments/components/comment-source-selector.tsx'
import { CommentSurface } from '@/features/resume-comments/components/comment-surface.tsx'
import { ResumeCommentProvider, useResumeCommentStore } from '@/features/resume-comments/context.tsx'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCollaborationStore } from '@/lib/collaboration'
import { DEFAULT_RESUME_FONT_FAMILY_NAME } from '@/lib/schema'
import { buildResumeShareSnapshotSource } from '@/lib/supabase/resume/share'
import useResumeListStore from '@/pages/resume/store'
import QuickDialog from '@/pages/share/components/quick-dialog'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import CollaborationPanelProvider from './components/collaboration'
import { CollaborationControls } from './components/collaboration/collaboration-controls'
import { CollaborationDialog } from './components/collaboration/collaboration-dialog'
import { CollaborationRuntime } from './components/collaboration/collaboration-runtime'
import { CommentReviewBanner } from './components/comment-review-banner'
import EditPanel from './components/edit-panel'
import ResumePreview from './components/preview'
import SidebarEditor from './components/sidebar'
import { useCommentReviewMode, usePrepareWorkingCommentWrite, useWorkingDocumentCommentSync } from './hooks/use-comment-review-mode'
import { useEditPanel } from './hooks/use-edit-panel'
import { useResumeLoader } from './hooks/use-resume-loader'
import { useScrollToSection } from './hooks/use-scroll-to-section'
import { useResumeReviewStore } from './review-store'

function Editor() {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const restoreEditPanelRef = useRef(false)
  const reviewUiRef = useRef<{
    activeTabId: ORDERType
    panelOpen: boolean
    scrollTop: number
  } | null>(null)
  const { theme } = useTheme()
  const { currentUser, loading } = useResumeLoader()

  const documentRef = useRef<HTMLDivElement | null>(null)
  const sourceRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const [documentState, setDocumentState] = useState<ResumeDocumentState>({
    status: 'measuring',
    signature: null,
    fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
    fontWeights: [400, 600, 700],
    error: null,
  })

  const resumeName = useResumeStore(state => state.basics.name)
  const currentResumeId = useCurrentResumeStore(state => state.resumeId)
  const editorMode = useResumeStore(state => state.mode)
  const collaborationRole = useCollaborationStore(state => state.role)
  const collaborationCommentAccess = useCollaborationStore(state => state.commentAccess)
  const collaborationRequested = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('collabSession')
  const collaboratorMode = collaborationRole === 'guest'
    || (collaborationRequested && collaborationRole !== 'host')
  const collaboratorCommentContext = useMemo(() => collaborationCommentAccess
    ? {
        kind: 'collaborator' as const,
        ...collaborationCommentAccess,
      }
    : null, [collaborationCommentAccess])
  const refreshCollaboratorCommentAccess = useCallback(async () => {
    const access = await useCollaborationStore.getState().refreshCommentAccess()
    return { kind: 'collaborator' as const, ...access }
  }, [])
  const resumes = useResumeListStore(state => state.resumes)
  const currentDisplayName = currentResumeId
    ? (resumes.find(resume => resume.resume_id === currentResumeId)?.display_name ?? null)
    : null
  const setSourceRef = useResumeExportStore(state => state.setSourceRef)
  const setHandlePrint = useResumeExportStore(state => state.setHandlePrint)
  const setExportDocumentState = useResumeExportStore(state => state.setDocumentState)
  const handlePrint = useResumePrint({
    contentRef: documentRef,
    documentState,
    documentTitle: resumeName ? `${resumeName}-简历` : '我的简历',
  })

  useEffect(() => {
    setSourceRef(sourceRef)
  }, [setSourceRef])

  useEffect(() => {
    setExportDocumentState(documentState)
  }, [documentState, setExportDocumentState])

  useEffect(() => {
    setHandlePrint(handlePrint)
    return () => setHandlePrint(null)
  }, [setHandlePrint, handlePrint])

  const activeTabId = useResumeStore(state => state.activeTabId)
  const order = useResumeStore(state => state.order)
  const updateActiveTabId = useResumeStore(state => state.updateActiveTabId)
  const updateOrder = useResumeStore(state => state.updateOrder)
  const toggleVisibility = useResumeStore(state => state.toggleVisibility)
  const visibilityState = useResumeStore(state => state.visibility)

  const fill = theme === 'dark' ? '#0c0a09' : '#fafaf9'
  const stroke = theme === 'dark' ? '#3d3b3b' : '#e7e5e4'

  // 桌面编辑面板开关 + 左导航自动让位（桌面恒为右侧常驻侧栏）
  const { open: panelOpen, setOpen: setPanelOpen } = useEditPanel()
  const prepareCommentWrite = usePrepareWorkingCommentWrite(currentResumeId)
  const commentReview = useCommentReviewMode({
    resumeId: currentResumeId,
    workingLabel: currentDisplayName ?? resumeName ?? '当前简历',
    enabled: commentsOpen,
    collaboratorMode,
    collaboratorAccess: collaboratorCommentContext,
  })
  const setReviewActive = useResumeReviewStore(state => state.setActive)
  useEffect(() => {
    setReviewActive(!commentReview.isWorking)
    return () => setReviewActive(false)
  }, [commentReview.isWorking, setReviewActive])
  const handleCommentsOpenChange = useCallback((nextOpen: boolean) => {
    setCommentsOpen(nextOpen)
    if (nextOpen) {
      restoreEditPanelRef.current = panelOpen
      setPanelOpen(false)
      if (open)
        setOpen(false)
      return
    }
    if (restoreEditPanelRef.current && !isMobile && commentReview.isWorking)
      setPanelOpen(true)
    restoreEditPanelRef.current = false
  }, [commentReview.isWorking, isMobile, open, panelOpen, setPanelOpen])
  const handleMobileEditOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && commentsOpen)
      handleCommentsOpenChange(false)
  }, [commentsOpen, handleCommentsOpenChange])
  const scrollToSection = useScrollToSection(previewScrollRef)
  // 桌面：点 tab 既切换又滚动渲染区到对应章节；移动端走底部抽屉
  const useSidebarMode = !isMobile
  const handleActivateWithScroll = useCallback((id: typeof activeTabId) => {
    updateActiveTabId(id)
    scrollToSection(id)
  }, [updateActiveTabId, scrollToSection])
  const handleCommentSourceChange = useCallback(async (key: Parameters<typeof commentReview.selectSource>[0]) => {
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
    if (!changed)
      return
    if (key !== 'working') {
      setPanelOpen(false)
      setOpen(false)
      return
    }
    if (leavingReview && reviewUiRef.current) {
      const saved = reviewUiRef.current
      updateActiveTabId(saved.activeTabId)
      restoreEditPanelRef.current = saved.panelOpen
      requestAnimationFrame(() => requestAnimationFrame(() => {
        previewScrollRef.current?.scrollTo({ top: saved.scrollTop })
      }))
      reviewUiRef.current = null
    }
  }, [activeTabId, commentReview, panelOpen, setPanelOpen, updateActiveTabId])

  const handleOpenSortDialog = useCallback(() => {
    setSortDialogOpen(true)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner className="mx-auto" />
          <p className="mt-4 text-muted-foreground">加载简历中...</p>
        </div>
      </div>
    )
  }

  return (
    <CollaborationPanelProvider>
      <CollaborationRuntime
        drawerOpen={useSidebarMode ? false : open}
        setDrawerOpen={useSidebarMode ? () => {} : handleMobileEditOpenChange}
        activeTabId={activeTabId}
        updateActiveTabId={useSidebarMode ? handleActivateWithScroll : updateActiveTabId}
        scrollContainerRef={previewScrollRef}
      />

      {useSidebarMode
        ? (
            // 桌面侧栏形态：外层 relative + h-full 撑满 dashboard 内容区，内层 absolute inset-0 精确填满，
            // 内部 overflow-hidden 不会把外层撑高（切断 min-h-svh 的增高循环），避免出现第二条页面滚动条。
            // 只有渲染区内部滚动，右侧编辑侧栏固定。
            <div className="relative h-full min-h-0 w-full">
              <div className="absolute inset-0 flex min-h-0 overflow-hidden">
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <AnimatePresence>
                    {!commentReview.isWorking
                      ? (
                          <CommentReviewBanner
                            sourceLabel={commentReview.sourceLabel}
                            switching={commentReview.switching}
                            onReturn={() => handleCommentSourceChange('working').catch(() => undefined)}
                          />
                        )
                      : null}
                  </AnimatePresence>
                  <ResumePreview
                    resumeRef={documentRef}
                    sourceRef={sourceRef}
                    onDocumentStateChange={setDocumentState}
                    scrollContainerRef={previewScrollRef}
                    snapshotOverride={commentReview.snapshotOverride}
                    manifestOverride={commentReview.manifestOverride}
                    projectionReferenceDate={commentReview.projectionReferenceDate}
                  />
                </div>
                <EditPanel
                  open={panelOpen && commentReview.isWorking}
                  order={order}
                  visibilityState={visibilityState}
                  onActivate={handleActivateWithScroll}
                  onUpdateOrder={updateOrder}
                  onToggleVisibility={toggleVisibility}
                  onClose={() => setPanelOpen(false)}
                />
                <AnimatePresence>
                  {!panelOpen && !commentsOpen && commentReview.isWorking && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                      className="fixed bottom-6 right-6 z-1"
                    >
                      <Button
                        variant="secondary"
                        className="shadow-md"
                        onClick={() => {
                          setCommentsOpen(false)
                          setPanelOpen(true)
                        }}
                      >
                        <Edit />
                        编辑简历
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        : (
            // 移动端：底部抽屉
            <>
              {commentReview.isWorking && (
                <Drawer open={open} onOpenChange={handleMobileEditOpenChange} showSwipeHandle>
                  <DrawerTrigger
                    render={(
                      <Button
                        variant="outline"
                        className="fixed bottom-6 left-1/2 z-1 -transform -translate-x-1/2"
                        size="icon"
                      />
                    )}
                  >
                    <Edit />
                  </DrawerTrigger>
                  <DrawerContent>
                    <CollaborationControls onOpenSortDialog={handleOpenSortDialog} />
                    <div className="@container/panel p-4 overflow-y-auto overflow-x-hidden">
                      <SidebarEditor
                        activeTabId={activeTabId}
                        order={order}
                        visibilityState={visibilityState}
                        fill={fill}
                        stroke={stroke}
                        isMobile={isMobile}
                        sortDialogOpen={sortDialogOpen}
                        onSortDialogOpenChange={setSortDialogOpen}
                        onUpdateActiveTabId={updateActiveTabId}
                        onUpdateOrder={updateOrder}
                        onToggleVisibility={toggleVisibility}
                      />
                    </div>
                  </DrawerContent>
                </Drawer>
              )}
              <div className="relative flex min-h-screen flex-col overflow-auto md:flex-row">
                <AnimatePresence>
                  {!commentReview.isWorking
                    ? (
                        <CommentReviewBanner
                          sourceLabel={commentReview.sourceLabel}
                          switching={commentReview.switching}
                          onReturn={() => handleCommentSourceChange('working').catch(() => undefined)}
                        />
                      )
                    : null}
                </AnimatePresence>
                <ResumePreview
                  resumeRef={documentRef}
                  sourceRef={sourceRef}
                  onDocumentStateChange={setDocumentState}
                  scrollContainerRef={previewScrollRef}
                  snapshotOverride={commentReview.snapshotOverride}
                  manifestOverride={commentReview.manifestOverride}
                  projectionReferenceDate={commentReview.projectionReferenceDate}
                />
              </div>
            </>
          )}
      {currentResumeId
        && editorMode === 'online'
        && currentUser
        && (!collaboratorMode || collaboratorCommentContext)
        ? (
            <ResumeCommentProvider
              key={currentResumeId}
              access={commentReview.access}
              beforeWrite={!collaboratorMode && commentReview.isWorking ? prepareCommentWrite : undefined}
              refreshAccess={collaboratorMode ? refreshCollaboratorCommentAccess : undefined}
              panelHeaderContent={(
                <>
                  <CommentSourceSelector
                    options={commentReview.sources}
                    value={commentReview.selectedKey}
                    loading={commentReview.sourcesLoading || commentReview.switching}
                    onChange={value => handleCommentSourceChange(value).catch(() => undefined)}
                  />
                  {commentReview.error
                    ? <p className="mt-2 text-xs text-destructive">{commentReview.error}</p>
                    : null}
                </>
              )}
            >
              <WorkingResumeComments
                resumeId={currentResumeId}
                syncWorkingDocument={!collaboratorMode && commentReview.isWorking}
                rootRef={documentRef}
                sourceLabel={commentReview.sourceLabel}
                currentUserId={currentUser?.id ?? null}
                canCreate={!collaboratorMode || collaborationCommentAccess?.role === 'editor'}
                canModerateAll={!collaboratorMode}
                open={commentsOpen}
                bookmarkVisible={!panelOpen && !open}
                onOpenChange={handleCommentsOpenChange}
                layoutRevision={`${commentReview.selectedKey}:${JSON.stringify(documentState.signature)}`}
              />
            </ResumeCommentProvider>
          )
        : null}
      <CollaborationDialog />
      <QuickDialog
        getSnapshot={() => buildResumeShareSnapshotSource(
          useResumeStore.getState().getPersistedSnapshot(),
          currentDisplayName,
        )}
      />
    </CollaborationPanelProvider>
  )
}

function WorkingResumeComments({
  resumeId,
  syncWorkingDocument,
  rootRef,
  sourceLabel,
  currentUserId,
  canCreate,
  canModerateAll,
  open,
  bookmarkVisible,
  onOpenChange,
  layoutRevision,
}: {
  resumeId: string
  syncWorkingDocument: boolean
  rootRef: RefObject<HTMLElement | null>
  sourceLabel: string
  currentUserId: string | null
  canCreate: boolean
  canModerateAll: boolean
  open: boolean
  bookmarkVisible: boolean
  onOpenChange: (open: boolean) => void
  layoutRevision: string
}) {
  useWorkingDocumentCommentSync(resumeId, syncWorkingDocument)
  const hasUnread = useResumeCommentStore(state => Object.values(state.threadReadStateById)
    .some(thread => thread.latestCommentEventSeq > Math.max(
      thread.lastReadEventSeq,
      state.lastReadEventSeq,
    )))
  return (
    <>
      {!open && bookmarkVisible
        ? (
            <CommentBookmark unread={hasUnread} onOpen={() => onOpenChange(true)} />
          )
        : null}
      <CommentSurface
        rootRef={rootRef}
        sourceLabel={sourceLabel}
        permissions={{
          canCreate,
          canModerateAll,
          currentUserId,
        }}
        layoutRevision={layoutRevision}
        open={open}
        onOpenChange={onOpenChange}
      />
    </>
  )
}

export default Editor
