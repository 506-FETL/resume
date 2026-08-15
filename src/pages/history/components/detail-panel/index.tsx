import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { History } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatDateTime } from '@/utils/date'
import useHistoryStore from '../../store'
import { getVersionTitle } from '../../utils'
import HistoryDetailContent from './detail-content'
import DetailDiscardDialog from './discard-dialog'
import DetailPanelLoadingState from './loading-state'

interface HistoryDetailPanelProps {
  state: HistoryDetailPanelState
}

export default function HistoryDetailPanel({
  state,
}: HistoryDetailPanelProps) {
  const isMobile = useIsMobile()
  const loading = useHistoryStore(state => state.loading)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [renderedEntry, setRenderedEntry] = useState<typeof state.selectedEntry>(null)
  const [renderedVersion, setRenderedVersion] = useState(state.selectedVersion)

  useEffect(() => {
    if (state.selectedEntry !== null) {
      setRenderedEntry(state.selectedEntry)
      setRenderedVersion(state.selectedVersion)
      setMobileOpen(true)
      return
    }

    if (renderedEntry !== null) {
      setMobileOpen(false)
    }
  }, [renderedEntry, state.selectedEntry, state.selectedVersion])

  const renderedState = useMemo(() => {
    if (state.selectedEntry !== null) {
      return state
    }

    if (renderedEntry === null) {
      return state
    }

    return {
      ...state,
      selectedEntry: renderedEntry,
      selectedVersion: renderedVersion,
    }
  }, [renderedEntry, renderedVersion, state])

  const title = renderedState.selectedEntry === 'current'
    ? '当前版本'
    : renderedState.selectedVersion
      ? getVersionTitle(renderedState.selectedVersion)
      : '版本内容'

  const description = renderedState.selectedEntry === 'current'
    ? '查看当前内容，并可直接保存为新版本。'
    : renderedState.selectedVersion
      ? `V${renderedState.selectedVersion.version_no} · ${formatDateTime(renderedState.selectedVersion.created_at)}`
      : '请选择一个版本。'
  const desktopPanelClassName = 'md:flex md:min-h-0 md:max-h-[min(78vh,920px)] md:flex-col md:overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:max-h-[920px]'

  const handleMobileClose = () => {
    setMobileOpen(false)
  }

  const handleMobileOpenChangeComplete = (open: boolean) => {
    if (open) {
      return
    }

    state.requestCloseDetail()
    setRenderedEntry(null)
    setRenderedVersion(null)
  }

  if (isMobile) {
    return (
      <>
        <Drawer
          open={mobileOpen}
          showSwipeHandle
          onOpenChangeComplete={handleMobileOpenChangeComplete}
          onOpenChange={(open) => {
            if (!open) {
              handleMobileClose()
            }
          }}
        >
          <DrawerContent className="flex flex-col overflow-hidden p-0">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {renderedState.selectedEntry && <HistoryDetailContent state={renderedState} />}
            </div>
            <Separator />
            <DrawerFooter className="shrink-0 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur supports-backdrop-filter:bg-background/80">
              <DrawerClose render={<Button variant="outline" onClick={handleMobileClose} />}>
                关闭
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <DetailDiscardDialog
          open={state.discardDialogOpen}
          onCancel={state.cancelDiscardChanges}
          onConfirm={state.confirmDiscardChanges}
        />
      </>
    )
  }

  return (
    <>
      {!state.selectedEntry
        ? (
            loading
              ? (
                  <Card className={`${desktopPanelClassName} border-border/70 bg-background/95 py-0 shadow-none`}>
                    <DetailPanelLoadingState />
                  </Card>
                )
              : (
                  <Card className={`${desktopPanelClassName} justify-center border-border/70 bg-background/95 py-0 shadow-none`}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <History />
                        </EmptyMedia>
                        <EmptyTitle>选择一个版本查看详情</EmptyTitle>
                        <EmptyDescription>
                          右侧会显示版本说明、当时的内容，以及恢复和编辑操作。
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </Card>
                )
          )
        : (
            <Card className={`${desktopPanelClassName} border-border/70 bg-background/95 py-0 shadow-none`}>
              <HistoryDetailContent state={state} />
            </Card>
          )}

      <DetailDiscardDialog
        open={state.discardDialogOpen}
        onCancel={state.cancelDiscardChanges}
        onConfirm={state.confirmDiscardChanges}
      />
    </>
  )
}
