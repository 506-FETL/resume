import type { ComponentProps } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Archive, Eye, History, Power, Settings2, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import useShareStore from '../../store'
import { getShareReturnFocus } from '../../hooks/use-share-dialog-focus'
import { buildShareUrl } from '../../utils'

interface ActionDrawerProps {
  open: boolean
  share: ResumeShareRecord | null
  restoreFocusTo: HTMLElement | null
  onOpenChange: (open: boolean) => void
}

export default function ActionDrawer({
  open,
  share,
  restoreFocusTo,
  onOpenChange,
}: ActionDrawerProps) {
  const {
    pendingShareIds,
    openSettingsDialog,
    openArchiveDialog,
    openDeleteDialog,
    openVersionDialog,
    setActive,
  } = useShareStore()

  const reduceMotion = useReducedMotion()
  const busy = Boolean(share && pendingShareIds.includes(share.id))

  const handleDrawerOpenChange: NonNullable<
    ComponentProps<typeof Drawer>['onOpenChange']
  > = (nextOpen, details) => {
    const nestedEscape =
      details.reason === 'escape-key' &&
      details.event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element &&
            node.matches(
              '[data-slot="dialog-content"], [role="alertdialog"], [role="listbox"], [role="menu"], [data-slot="popover-content"]',
            ),
        )

    if (!nextOpen && (busy || nestedEscape)) {
      details.cancel()

      return
    }

    onOpenChange(nextOpen)
  }

  const handlePreview = () => {
    if (!share) return

    window.open(buildShareUrl(share.token), '_blank', 'noopener,noreferrer')
    onOpenChange(false)
  }

  const handleSettings = () => {
    if (!share) return

    openSettingsDialog(share.id)
  }

  const handleVersion = () => {
    if (!share) return

    openVersionDialog(share.id)
  }

  const handleToggleActive = async () => {
    if (!share) return

    try {
      await setActive(share.id, !share.is_active)
      toast.success(share.is_active ? '链接已关闭' : '链接已启用')
      onOpenChange(false)
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = () => {
    if (!share) return

    openDeleteDialog(share.id)
  }

  const handleArchive = () => {
    if (!share) return

    openArchiveDialog(share.id)
  }

  const actions = [
    {
      key: 'preview',
      node: (
        <Button
          variant='outline'
          className='h-11 w-full justify-start'
          disabled={Boolean(share?.archivedAt)}
          onClick={handlePreview}
        >
          <Eye data-icon='inline-start' />
          预览
        </Button>
      ),
    },
    {
      key: 'settings',
      node: (
        <Button
          variant='outline'
          className='h-11 w-full justify-start'
          disabled={busy || Boolean(share?.archivedAt)}
          onClick={handleSettings}
        >
          <Settings2 data-icon='inline-start' />
          编辑设置
        </Button>
      ),
    },
    {
      key: 'version',
      node: (
        <Button
          variant='outline'
          className='h-11 w-full justify-start'
          disabled={busy || Boolean(share?.archivedAt)}
          onClick={handleVersion}
        >
          <History data-icon='inline-start' />
          更换分享版本
        </Button>
      ),
    },
    {
      key: 'power',
      node: (
        <Button
          variant='outline'
          className='h-11 w-full justify-start'
          disabled={busy || Boolean(share?.archivedAt)}
          onClick={handleToggleActive}
        >
          {busy ? (
            <Spinner data-icon='inline-start' />
          ) : (
            <Power data-icon='inline-start' />
          )}
          {share?.is_active ? '关闭链接' : '启用链接'}
        </Button>
      ),
    },
  ]

  return (
    <Drawer open={open} showSwipeHandle onOpenChange={handleDrawerOpenChange}>
      <DrawerContent
        data-share-dialog-fallback=''
        finalFocus={() => getShareReturnFocus(restoreFocusTo) ?? false}
      >
        <DrawerHeader className='shrink-0 pb-4 text-left'>
          <DrawerTitle className='line-clamp-2 break-words'>
            {share?.label || '分享链接'}
          </DrawerTitle>
          <DrawerDescription className='line-clamp-2 break-words'>
            {share?.display_name || '选择要执行的操作'}
          </DrawerDescription>
        </DrawerHeader>
        <div className='scrollbar-thin-subtle grid min-h-0 grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]'>
          {actions.map((action, index) => (
            <motion.div
              key={action.key}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                delay: reduceMotion ? 0 : staggerDelay(index),
              }}
            >
              {action.node}
            </motion.div>
          ))}
          {!share?.archivedAt && (
            <motion.div
              className='col-span-2'
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                delay: reduceMotion ? 0 : staggerDelay(actions.length),
              }}
            >
              <Button
                variant='outline'
                className='h-11 w-full justify-start'
                disabled={busy}
                onClick={handleArchive}
              >
                <Archive data-icon='inline-start' />
                归档分享
              </Button>
            </motion.div>
          )}
          <motion.div
            className='col-span-2'
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
              delay: reduceMotion ? 0 : staggerDelay(actions.length),
            }}
          >
            <Button
              variant='destructive'
              className='h-11 w-full justify-start'
              disabled={busy}
              onClick={handleDelete}
            >
              <Trash2 data-icon='inline-start' />
              永久删除
            </Button>
          </motion.div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
