import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Eye, Power, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

interface ActionDrawerProps {
  share: ResumeShareRecord | null
  restoreFocusTo: HTMLElement | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onPreview: () => void
  onSettings: () => void
  onPushLatest: () => void
  onToggleActive: () => void
  onDelete: () => void
}

export default function ActionDrawer({
  share,
  restoreFocusTo,
  busy,
  onOpenChange,
  onPreview,
  onSettings,
  onPushLatest,
  onToggleActive,
  onDelete,
}: ActionDrawerProps) {
  const reduceMotion = useReducedMotion()
  const actions = [
    { key: 'preview', node: (
      <Button variant="outline" className="h-11 w-full justify-start" onClick={onPreview}>
        <Eye data-icon="inline-start" className="text-blue-600" />
        预览
      </Button>
    ) },
    { key: 'settings', node: (
      <Button variant="outline" className="h-11 w-full justify-start" onClick={onSettings}>
        <Settings2 data-icon="inline-start" />
        编辑设置
      </Button>
    ) },
    { key: 'push', node: (
      <Button variant="outline" className="h-11 w-full justify-start" disabled={busy} onClick={onPushLatest}>
        <RefreshCw data-icon="inline-start" />
        推送最新版
      </Button>
    ) },
    { key: 'power', node: (
      <Button variant="outline" className="h-11 w-full justify-start" disabled={busy} onClick={onToggleActive}>
        <Power data-icon="inline-start" />
        {share?.is_active ? '关闭链接' : '启用链接'}
      </Button>
    ) },
  ]

  return (
    <Drawer
      open={Boolean(share)}
      onOpenChange={(open) => {
        if (open && document.activeElement instanceof HTMLElement)
          document.activeElement.blur()
        onOpenChange(open)
        if (!open) {
          requestAnimationFrame(() => {
            if (restoreFocusTo?.isConnected)
              restoreFocusTo.focus()
          })
        }
      }}
    >
      <DrawerContent className="rounded-t-[28px]">
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
            <Button variant="ghost" className="h-11 w-full justify-start text-destructive hover:text-destructive" disabled={busy} onClick={onDelete}>
              <Trash2 data-icon="inline-start" />
              永久删除
            </Button>
          </motion.div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
