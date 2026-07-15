import type { PreviewTarget } from '../../types'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatDateTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import useHistoryStore from '../../store'
import { getVersionTitle } from '../../utils'
import SnapshotPreview from '../shared/snapshot-preview'

interface HistoryPreviewDialogProps {
  previewTarget: PreviewTarget
  onClose: () => void
}

const DRAWER_EXIT_DURATION = 220

export default function HistoryPreviewDialog({
  previewTarget,
  onClose,
}: HistoryPreviewDialogProps) {
  const isMobile = useIsMobile()
  const { currentResume, versions } = useHistoryStore()
  const [renderTarget, setRenderTarget] = useState<PreviewTarget>(previewTarget)
  const [mobileOpen, setMobileOpen] = useState(Boolean(previewTarget))
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (previewTarget) {
      setRenderTarget(previewTarget)
      setMobileOpen(true)
      return
    }

    if (renderTarget) {
      setMobileOpen(false)
      closeTimerRef.current = window.setTimeout(() => {
        setRenderTarget(null)
        closeTimerRef.current = null
      }, DRAWER_EXIT_DURATION)
    }
  }, [previewTarget, renderTarget])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const selectedVersion = useMemo(
    () => typeof renderTarget === 'number'
      ? versions.find(version => version.id === renderTarget) ?? null
      : null,
    [renderTarget, versions],
  )

  const snapshot = renderTarget === 'current' ? currentResume?.snapshot : selectedVersion?.snapshot
  const selectedSourceMeta = selectedVersion ? SOURCE_META[selectedVersion.source_type] : null
  const SelectedSourceIcon = selectedSourceMeta?.icon

  if (!renderTarget || !snapshot) {
    return null
  }

  const title = renderTarget === 'current'
    ? `${currentResume?.displayName || '当前简历'} · 当前内容`
    : getVersionTitle(selectedVersion!)
  const description = renderTarget === 'current'
    ? '当前内容的只读预览。'
    : `V${selectedVersion!.version_no} · ${formatDateTime(selectedVersion!.created_at)}`

  const handleMobileClose = () => {
    setMobileOpen(false)

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }

    closeTimerRef.current = window.setTimeout(() => {
      setRenderTarget(null)
      closeTimerRef.current = null
      onClose()
    }, DRAWER_EXIT_DURATION)
  }

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleMobileClose()
          }
        }}
      >
        <DrawerContent className="flex h-[94dvh] max-h-[94dvh] flex-col overflow-hidden rounded-t-[28px] p-0">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <Separator />
          <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 py-4 pb-8">
              {selectedVersion && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge className={selectedSourceMeta?.badgeClassName}>
                    {SelectedSourceIcon && <SelectedSourceIcon />}
                    {selectedSourceMeta?.label}
                  </Badge>
                  {selectedVersion.milestone_name && (
                    <Badge variant="outline">{selectedVersion.milestone_name}</Badge>
                  )}
                </div>
              )}
              <SnapshotPreview snapshot={snapshot} />
            </div>
          </div>
          <Separator />
          <DrawerFooter className="shrink-0 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur supports-backdrop-filter:bg-background/80">
            <DrawerClose asChild>
              <Button variant="outline" onClick={handleMobileClose}>关闭</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={Boolean(previewTarget)} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(90vh,920px)] w-[calc(78vw)] min-w-0 max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border/70 bg-background/95 p-0 shadow-xl backdrop-blur sm:max-w-[min(1480px,calc(100vw-2rem))] lg:max-w-[min(1600px,calc(78vw))]"
      >
        <DialogHeader className="shrink-0 px-5 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="关闭预览">
                <X />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <Separator />
        <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 py-4 pb-8 sm:px-6 sm:py-5 sm:pb-6 lg:px-8 lg:py-6">
            {selectedVersion && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge className={selectedSourceMeta?.badgeClassName}>
                  {SelectedSourceIcon && <SelectedSourceIcon data-icon="inline-start" />}
                  {selectedSourceMeta?.label}
                </Badge>
                {selectedVersion.milestone_name && (
                  <Badge variant="outline">{selectedVersion.milestone_name}</Badge>
                )}
              </div>
            )}
            <SnapshotPreview snapshot={snapshot} />
          </div>
        </div>
        <Separator />
        <DialogFooter className="shrink-0 bg-muted/30 px-5 py-4 sm:px-6 lg:px-8">
          <DialogClose asChild>
            <Button variant="outline">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
