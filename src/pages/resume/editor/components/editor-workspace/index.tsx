import type { EditorWorkspaceProps } from './types'
import { useEditorWorkspace } from './use-editor-workspace'
import { WorkingResumeComments } from './working-resume-comments'
import { JobContextBar } from '@/components/job-context'
import { lazy, Suspense, type CSSProperties } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Edit } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { RouteSkeleton } from '@/components/route-skeleton'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerVirtualKeyboardProvider,
} from '@/components/ui/drawer'
import { CommentSourceSelector } from '@/features/resume-comments/components/comment-source-selector.tsx'
import { ResumeCommentProvider } from '@/features/resume-comments/context.tsx'
import { DURATION, EASE } from '@/lib/motion'
import QuickDialog from '@/pages/share/components/quick-dialog'
import CollaborationPanelProvider from '../../components/collaboration'
import { CollaborationControls } from '../../components/collaboration/collaboration-controls'
import { CollaborationDialog } from '../../components/collaboration/collaboration-dialog'
import { CollaborationRuntime } from '../../components/collaboration/collaboration-runtime'
import { CommentReviewBanner } from '../../components/comment-review-banner'
import EditPanel from '../../components/edit-panel'
import CheckWorkspace from '../../components/check-workspace'
import { CheckModeToggle } from '../../components/check-workspace/mode-toggle'
import CheckRuntime from '../../components/check-runtime'
import ResumePreview from '../../components/preview'
import SidebarEditor from '../../components/sidebar'

const EditorGuides = lazy(() => import('@/features/feature-guides/editor'))

function EditorWorkspace({ currentUser, loading }: EditorWorkspaceProps) {
  const {
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
  } = useEditorWorkspace(loading)

  if (loading) {
    return <RouteSkeleton pathname='/resume/editor' />
  }

  return (
    <CollaborationPanelProvider>
      <CheckRuntime
        rootRef={documentRef}
        documentState={documentState}
        review={!commentReview.isWorking}
      />
      <CollaborationRuntime
        drawerOpen={useSidebarMode ? false : open}
        setDrawerOpen={useSidebarMode ? () => {} : handleMobileEditOpenChange}
        activeTabId={activeTabId}
        updateActiveTabId={
          useSidebarMode ? handleActivateWithScroll : updateActiveTabId
        }
        scrollContainerRef={previewScrollRef}
      />

      {useSidebarMode ? (
        // 桌面侧栏形态：外层 relative + h-full 撑满 dashboard 内容区，内层 absolute inset-0 精确填满，
        // 内部 overflow-hidden 不会把外层撑高（切断 min-h-svh 的增高循环），避免出现第二条页面滚动条。
        // 只有渲染区内部滚动，右侧编辑侧栏固定。
        <div className='relative h-full min-h-0 w-full'>
          <div className='absolute inset-0 flex min-h-0 overflow-hidden'>
            <div className='relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
              <JobContextBar />
              <AnimatePresence>
                {!commentReview.isWorking ? (
                  <CommentReviewBanner
                    sourceLabel={commentReview.sourceLabel}
                    switching={commentReview.switching}
                    onReturn={() =>
                      handleCommentSourceChange('working').catch(
                        () => undefined,
                      )
                    }
                  />
                ) : null}
              </AnimatePresence>
              <ResumePreview
                checksVisible={panelOpen && commentReview.isWorking}
                resumeRef={documentRef}
                sourceRef={sourceRef}
                onDocumentStateChange={setDocumentState}
                scrollContainerRef={previewScrollRef}
                snapshotOverride={commentReview.snapshotOverride}
                definitionOverride={commentReview.definitionOverride}
                projectionReferenceDate={commentReview.projectionReferenceDate}
              />
            </div>
            <EditPanel
              panelRef={editPanelElementRef}
              open={panelOpen && commentReview.isWorking}
              order={order}
              visibilityState={visibilityState}
              onActivate={handleActivateWithScroll}
              onUpdateOrder={updateOrder}
              onToggleVisibility={toggleVisibility}
              onClose={closeEditPanel}
            />
            <AnimatePresence>
              {!panelOpen && !commentsOpen && commentReview.isWorking && (
                <PresenceDiv
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: reduceMotion ? 0 : 8,
                    transition: {
                      duration: reduceMotion ? 0 : DURATION.fast,
                      ease: EASE.in,
                    },
                  }}
                  transition={{
                    duration: reduceMotion ? 0 : DURATION.base,
                    ease: EASE.out,
                  }}
                  className='fixed bottom-6 right-6 z-1'
                >
                  <Button
                    ref={editTriggerElementRef}
                    className='shadow-md'
                    onClick={() => {
                      if (document.activeElement instanceof HTMLElement)
                        document.activeElement.blur()

                      focusEditPanelRef.current = true
                      setCommentsOpen(false)
                      setPanelOpen(true)
                    }}
                  >
                    <Edit />
                    编辑简历
                  </Button>
                </PresenceDiv>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        // 移动端：底部抽屉
        <>
          {commentReview.isWorking && (
            <Drawer
              open={open}
              onOpenChange={handleMobileEditOpenChange}
              showSwipeHandle
            >
              <DrawerTrigger
                render={
                  <Button
                    aria-label='编辑简历'
                    className='fixed bottom-6 left-1/2 z-1 -transform -translate-x-1/2'
                    size='icon'
                  />
                }
              >
                <Edit />
              </DrawerTrigger>
              <DrawerVirtualKeyboardProvider>
                <DrawerContent
                  className='@container/editor-drawer @container-[size]'
                  style={
                    {
                      '--drawer-content-height': '90dvh',
                      '--drawer-content-max-height': '90dvh',
                    } as CSSProperties
                  }
                >
                  <CheckWorkspace
                    header={
                      <div className='shrink-0 [@container_editor-drawer_(max-height:320px)]:**:data-[slot=drawer-header]:gap-1 [@container_editor-drawer_(max-height:320px)]:**:data-[slot=drawer-header]:p-2'>
                        <CollaborationControls
                          onOpenSortDialog={handleOpenSortDialog}
                          actions={<CheckModeToggle />}
                        />
                      </div>
                    }
                  >
                    <div className='@container/panel flex min-h-0 flex-1 flex-col overflow-hidden p-4 [@container_editor-drawer_(max-height:320px)]:p-0'>
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
                  </CheckWorkspace>
                </DrawerContent>
              </DrawerVirtualKeyboardProvider>
            </Drawer>
          )}
          <div className='relative flex min-h-full flex-col overflow-auto md:flex-row'>
            <JobContextBar />
            <AnimatePresence>
              {!commentReview.isWorking ? (
                <CommentReviewBanner
                  sourceLabel={commentReview.sourceLabel}
                  switching={commentReview.switching}
                  onReturn={() =>
                    handleCommentSourceChange('working').catch(() => undefined)
                  }
                />
              ) : null}
            </AnimatePresence>
            <ResumePreview
              checksVisible={open && commentReview.isWorking}
              resumeRef={documentRef}
              sourceRef={sourceRef}
              onDocumentStateChange={setDocumentState}
              scrollContainerRef={previewScrollRef}
              snapshotOverride={commentReview.snapshotOverride}
              definitionOverride={commentReview.definitionOverride}
              projectionReferenceDate={commentReview.projectionReferenceDate}
            />
          </div>
        </>
      )}
      {currentResumeId &&
      editorMode === 'online' &&
      currentUser &&
      (!collaboratorMode || collaboratorCommentContext) ? (
        <ResumeCommentProvider
          key={currentResumeId}
          access={commentReview.access}
          beforeWrite={
            !collaboratorMode && commentReview.isWorking
              ? prepareCommentWrite
              : undefined
          }
          refreshAccess={
            collaboratorMode ? refreshCollaboratorCommentAccess : undefined
          }
          panelHeaderContent={
            <>
              <CommentSourceSelector
                options={commentReview.sources}
                value={commentReview.selectedKey}
                loading={
                  commentReview.sourcesLoading || commentReview.switching
                }
                onChange={(value) =>
                  handleCommentSourceChange(value).catch(() => undefined)
                }
              />
              {commentReview.error ? (
                <p className='mt-2 text-xs text-destructive'>
                  {commentReview.error}
                </p>
              ) : null}
            </>
          }
        >
          <WorkingResumeComments
            resumeId={currentResumeId}
            syncWorkingDocument={!collaboratorMode && commentReview.isWorking}
            rootRef={documentRef}
            sourceLabel={commentReview.sourceLabel}
            currentUserId={currentUser?.id ?? null}
            canCreate={
              !collaboratorMode || collaborationCommentAccess?.role === 'editor'
            }
            canModerateAll={!collaboratorMode}
            open={commentsOpen}
            bookmarkVisible={!panelOpen && !open}
            onOpenChange={handleCommentsOpenChange}
            layoutRevision={`${commentReview.selectedKey}:${JSON.stringify(documentState.signature)}`}
          />
        </ResumeCommentProvider>
      ) : null}
      <CollaborationDialog />
      <QuickDialog getSnapshot={getShareSnapshot} />
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <EditorGuides
            rootRef={documentRef}
            editPanelRef={editPanelElementRef}
            contextKey={`${currentResumeId}:${commentReview.selectedKey}`}
            mobile={isMobile}
            commentEnabled={Boolean(
              currentResumeId &&
              currentUser &&
              editorMode === 'online' &&
              !collaboratorMode &&
              commentReview.isWorking &&
              documentState.status === 'ready' &&
              !panelOpen &&
              !open &&
              !commentsOpen,
            )}
            sortingEnabled={
              commentReview.isWorking && (panelOpen || open) && !sortDialogOpen
            }
          />
        </Suspense>
      </ErrorBoundary>
    </CollaborationPanelProvider>
  )
}

export default EditorWorkspace
