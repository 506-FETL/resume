import { Edit } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import CollaborationPanelProvider from './components/collaboration'
import { CollaborationControls } from './components/collaboration/collaboration-controls'
import { CollaborationDialog } from './components/collaboration/collaboration-dialog'
import { CollaborationRuntime } from './components/collaboration/collaboration-runtime'
import EditPanel from './components/edit-panel'
import ResumePreview from './components/preview'
import SidebarEditor from './components/sidebar'
import { useEditPanel } from './hooks/use-edit-panel'
import { useResumeLoader } from './hooks/use-resume-loader'
import { useScrollToSection } from './hooks/use-scroll-to-section'

function Editor() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const { theme } = useTheme()
  const { loading } = useResumeLoader()

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

  const fill = theme === 'dark' ? '#0c0a09' : '#fafaf9'
  const stroke = theme === 'dark' ? '#3d3b3b' : '#e7e5e4'

  // 桌面编辑面板形态（侧栏/抽屉）+ 开关 + 左导航自动让位
  const { mode, setMode, open: panelOpen, setOpen: setPanelOpen } = useEditPanel()
  const scrollToSection = useScrollToSection(previewScrollRef)
  // 桌面侧栏形态：点 tab 既切换又滚动渲染区到对应章节
  const useSidebarMode = !isMobile && mode === 'sidebar'
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
        setDrawerOpen={useSidebarMode ? () => {} : setOpen}
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
                  <ResumePreview resumeRef={resumeRef} scrollContainerRef={previewScrollRef} />
                </div>
                <EditPanel
                  open={panelOpen}
                  activeTabId={activeTabId}
                  order={order}
                  visibilityState={visibilityState}
                  fill={fill}
                  stroke={stroke}
                  onActivate={handleActivateWithScroll}
                  onUpdateOrder={updateOrder}
                  onToggleVisibility={toggleVisibility}
                  onClose={() => setPanelOpen(false)}
                  onSwitchToDrawer={() => {
                    setPanelOpen(false)
                    setMode('drawer')
                  }}
                />
                {!panelOpen && (
                  <Button
                    variant="outline"
                    className="fixed bottom-6 right-6 z-1 shadow-md"
                    onClick={() => setPanelOpen(true)}
                  >
                    <Edit />
                    编辑简历
                  </Button>
                )}
              </div>
            </div>
          )
        : (
            // 移动端 / 桌面抽屉形态：底部抽屉
            <>
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
              {/* 桌面抽屉形态：提供切回侧栏的入口 */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="fixed bottom-6 right-6 z-1"
                  onClick={() => setMode('sidebar')}
                >
                  切换为侧栏
                </Button>
              )}
            </>
          )}
      <CollaborationDialog />
    </CollaborationPanelProvider>
  )
}

export default Editor
