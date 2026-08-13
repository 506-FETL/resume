import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { Edit, MessageSquareText } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { useTheme } from '@/components/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { CommentSurface } from '@/features/resume-comments/components/comment-surface.tsx'
import { ResumeCommentProvider, useResumeCommentStore } from '@/features/resume-comments/context.tsx'
import { useIsMobile } from '@/hooks/use-mobile'
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
import EditPanel from './components/edit-panel'
import ResumePreview from './components/preview'
import SidebarEditor from './components/sidebar'
import { usePrepareWorkingCommentWrite, useWorkingDocumentCommentSync } from './hooks/use-comment-review-mode'
import { useEditPanel } from './hooks/use-edit-panel'
import { useResumeLoader } from './hooks/use-resume-loader'
import { useScrollToSection } from './hooks/use-scroll-to-section'

function Editor() {
  const isMobile = useIsMobile()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const restoreEditPanelRef = useRef(false)
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
  const handleCommentsOpenChange = useCallback((nextOpen: boolean) => {
    setCommentsOpen(nextOpen)
    if (nextOpen) {
      restoreEditPanelRef.current = panelOpen
      setPanelOpen(false)
      if (open)
        setOpen(false)
      return
    }
    if (restoreEditPanelRef.current && !isMobile)
      setPanelOpen(true)
    restoreEditPanelRef.current = false
  }, [isMobile, open, panelOpen, setPanelOpen])
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

  const handleOpenSortDialog = useCallback(() => {
    requestAnimationFrame(() => {
      setSortDialogOpen(true)
    })
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
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <ResumePreview
                    resumeRef={documentRef}
                    sourceRef={sourceRef}
                    onDocumentStateChange={setDocumentState}
                    scrollContainerRef={previewScrollRef}
                  />
                </div>
                <EditPanel
                  open={panelOpen}
                  order={order}
                  visibilityState={visibilityState}
                  onActivate={handleActivateWithScroll}
                  onUpdateOrder={updateOrder}
                  onToggleVisibility={toggleVisibility}
                  onClose={() => setPanelOpen(false)}
                />
                <AnimatePresence>
                  {!panelOpen && !commentsOpen && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                      className="fixed bottom-6 right-6 z-1"
                    >
                      <Button
                        variant="outline"
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
                <DrawerContent className="h-160">
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
              <div className="flex flex-col md:flex-row min-h-screen overflow-auto">
                <ResumePreview
                  resumeRef={documentRef}
                  sourceRef={sourceRef}
                  onDocumentStateChange={setDocumentState}
                  scrollContainerRef={previewScrollRef}
                />
              </div>
            </>
          )}
      {currentResumeId && editorMode === 'online' && currentUser
        ? (
            <ResumeCommentProvider
              key={currentResumeId}
              access={{ kind: 'owner', resumeId: currentResumeId }}
              beforeWrite={prepareCommentWrite}
              commentsVisible={commentsOpen}
            >
              <WorkingResumeComments
                resumeId={currentResumeId}
                rootRef={documentRef}
                sourceLabel={currentDisplayName ?? resumeName ?? '当前简历'}
                currentUserId={currentUser?.id ?? null}
                open={commentsOpen}
                onOpenChange={handleCommentsOpenChange}
                layoutRevision={JSON.stringify(documentState.signature)}
              />
            </ResumeCommentProvider>
          )
        : (
            <Button
              variant="outline"
              disabled
              title={editorMode === 'offline' ? '离线简历不能评论' : '登录后才能评论'}
              className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-20 shadow-md md:right-36 md:bottom-6 md:z-1"
            >
              <MessageSquareText />
              评论
            </Button>
          )}
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
  rootRef,
  sourceLabel,
  currentUserId,
  open,
  onOpenChange,
  layoutRevision,
}: {
  resumeId: string
  rootRef: RefObject<HTMLElement | null>
  sourceLabel: string
  currentUserId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  layoutRevision: string
}) {
  useWorkingDocumentCommentSync(resumeId)
  const hasUnread = useResumeCommentStore(state => state.lastEventSeq > state.lastReadEventSeq)
  return (
    <>
      {!open
        ? (
            <Button
              data-resume-comment-ui
              variant="outline"
              className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-20 shadow-md md:right-36 md:bottom-6 md:z-1"
              onClick={() => onOpenChange(true)}
            >
              <MessageSquareText />
              评论
              {hasUnread ? <Badge variant="destructive">新</Badge> : null}
            </Button>
          )
        : null}
      <CommentSurface
        rootRef={rootRef}
        sourceLabel={sourceLabel}
        presentation="docked"
        permissions={{
          canCreate: true,
          canModerateAll: true,
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
