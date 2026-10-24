import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import useUpgradeDialogStore from '@/store/upgrade-dialog'
import { formatResetTime } from './utils'

/**
 * 超额升级占位 Dialog。全局挂载（App.tsx），由 `useUpgradeDialogStore` 控制开关。
 * 触发来源：AI 超额自动弹出、用户中心「升级」按钮。
 */
export function UpgradeDialog() {
  const open = useUpgradeDialogStore((s) => s.open)
  const reason = useUpgradeDialogStore((s) => s.reason)
  const resetAt = useUpgradeDialogStore((s) => s.resetAt)
  const setOpen = useUpgradeDialogStore((s) => s.setOpen)

  const title = reason === 'quota_exceeded' ? '今日 AI 额度已用完' : '升级 Pro'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            免费版每日 20 次 AI 额度，
            {formatResetTime(resetAt)}
            。Pro 升级暂未开放。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>我知道了</Button>
          </DialogClose>
          <Button onClick={() => toast('Pro 升级暂未开放')}>
            <Sparkles />
            升级 Pro（暂未开放）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
