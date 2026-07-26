import { Edit } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { RealtimeCursors } from '@/components/realtime-cursors'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { getUserDisplayName } from '@/hooks/use-current-user'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCollaborationStore } from '@/lib/collaboration'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import CollaborationPanelProvider from './components/collaboration'
import { CollaborationControls } from './components/collaboration/collaboration-controls'
import { CollaborationDialog } from './components/collaboration/collaboration-dialog'
import { CollaborationUISync } from './components/collaboration/collaboration-ui-sync'
import ResumePreview from './components/preview'
import SidebarEditor from './components/sidebar'
import { useResumeLoader } from './hooks/use-resume-loader'

function Editor() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const { theme } = useTheme()
  const { loading, currentUser } = useResumeLoader()

  const resumeRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)

  const resumeName = useResumeStore(state => state.basics.name)
  const setResumeRef = useResumeExportStore(state => state.setResumeRef)
  const setHandlePrint = useResumeExportStore(state => state.setHandlePrint)

  const handlePrint = useReactToPrint({
    contentRef: resumeRef,
    documentTitle: resumeName ? `${resumeName}-简历` : '我的简历',
    pageStyle: `
      @page {
        size: A4;
        margin: 0;
      }
    `,
  })

  useEffect(() => {
    setResumeRef(resumeRef)
  }, [setResumeRef])

  useEffect(() => {
    setHandlePrint(handlePrint)
  }, [setHandlePrint, handlePrint])

  const activeTabId = useResumeStore(state => state.activeTabId)
  const order = useResumeStore(state => state.order)
  const updateActiveTabId = useResumeStore(state => state.updateActiveTabId)
  const updateOrder = useResumeStore(state => state.updateOrder)
  const toggleVisibility = useResumeStore(state => state.toggleVisibility)
  const visibilityState = useResumeStore(state => state.visibility)

  const roomName = useCollaborationStore(state => state.roomName)
  const isSharing = useCollaborationStore(state => state.isSharing)
  const selfColor = useCollaborationStore(state => state.selfColor)

  const fill = theme === 'dark' ? '#0c0a09' : '#fafaf9'
  const stroke = theme === 'dark' ? '#3d3b3b' : '#e7e5e4'
  const userDisplayName = getUserDisplayName(currentUser)

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

      {roomName && currentUser && selfColor && (
        <RealtimeCursors roomName={roomName} username={userDisplayName} color={selfColor} />
      )}

      {/* 协作 UI 状态同步 */}
      {roomName && isSharing && currentUser && selfColor && (
        <CollaborationUISync
          roomName={roomName}
          username={userDisplayName}
          color={selfColor}
          drawerOpen={open}
          setDrawerOpen={setOpen}
          activeTabId={activeTabId}
          onUpdateActiveTabId={updateActiveTabId}
          scrollContainerRef={previewScrollRef}
        />
      )}

      <Drawer open={open} onOpenChange={setOpen} handleOnly>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            className="fixed bottom-6 left-1/2 z-1 -transform -translate-x-1/2"
            size={isMobile ? 'icon' : 'default'}
          >
            <Edit />
            {!isMobile && '编辑简历'}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-160">
          <CollaborationControls onOpenSortDialog={isMobile ? handleOpenSortDialog : undefined} />
          <div className="p-4 overflow-y-auto overflow-x-hidden">
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
        <ResumePreview resumeRef={resumeRef} scrollContainerRef={previewScrollRef} />
      </div>
      <CollaborationDialog />
    </CollaborationPanelProvider>
  )
}

export default Editor
