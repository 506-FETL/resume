import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Eye, History, Power, Settings2, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import useShareStore from '../../store'
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
    openDeleteDialog,
    openVersionDialog,
    setActive,
  } = useShareStore()
  const reduceMotion = useReducedMotion()
  const busy = Boolean(share && pendingShareIds.includes(share.id))

  const handleDrawerOpenChange = (nextOpen: boolean) => {
    if (nextOpen && document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    onOpenChange(nextOpen)
    if (!nextOpen) {
      requestAnimationFrame(() => {
        if (restoreFocusTo?.isConnected)
          restoreFocusTo.focus()
      })
    }
  }

  const handlePreview = () => {
    if (!share)
      return
    window.open(buildShareUrl(share.token), '_blank', 'noopener,noreferrer')
    handleDrawerOpenChange(false)
  }

  const handleSettings = () => {
    if (!share)
      return
    openSettingsDialog(share.id)
    handleDrawerOpenChange(false)
  }

  const handleVersion = () => {
    if (!share)
      return
    openVersionDialog(share.id)
    handleDrawerOpenChange(false)
  }

  const handleToggleActive = async () => {
    if (!share)
      return
    try {
      await setActive(share.id, !share.is_active)
      toast.success(share.is_active ? '链接已关闭' : '链接已启用')
      handleDrawerOpenChange(false)
    }
    catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = () => {
    if (!share)
      return
    openDeleteDialog(share.id)
    handleDrawerOpenChange(false)
  }

  const actions = [
    { key: 'preview', node: (
      <Button variant="outline" className="h-11 w-full justify-start" onClick={handlePreview}>
        <Eye data-icon="inline-start" />
        预览
      </Button>
    ) },
    { key: 'settings', node: (
      <Button variant="outline" className="h-11 w-full justify-start" disabled={busy} onClick={handleSettings}>
        <Settings2 data-icon="inline-start" />
        编辑设置
      </Button>
    ) },
    { key: 'version', node: (
      <Button variant="outline" className="h-11 w-full justify-start" disabled={busy} onClick={handleVersion}>
        <History data-icon="inline-start" />
        更换分享版本
      </Button>
    ) },
    { key: 'power', node: (
      <Button variant="outline" className="h-11 w-full justify-start" disabled={busy} onClick={handleToggleActive}>
        <Power data-icon="inline-start" />
        {share?.is_active ? '关闭链接' : '启用链接'}
      </Button>
    ) },
  ]

  return (
    <Drawer
      open={open}
      showSwipeHandle
      onOpenChange={handleDrawerOpenChange}
    >
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{share?.label || '分享链接'}</DrawerTitle>
          <DrawerDescription>{share?.display_name || '选择要执行的操作'}</DrawerDescription>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {actions.map((action, index) => (
            <motion.div
              key={action.key}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : index * 0.035 }}
            >
              {action.node}
            </motion.div>
          ))}
          <motion.div
            className="col-span-2"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : actions.length * 0.035 }}
          >
            <Button variant="destructive" className="h-11 w-full justify-start" disabled={busy} onClick={handleDelete}>
              <Trash2 data-icon="inline-start" />
              永久删除
            </Button>
          </motion.div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
