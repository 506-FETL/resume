import { Check, Sparkles } from 'lucide-react'
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

// 升级版权益占位文案（无需真实价格/支付）
const PRO_BENEFITS = [
  '每日 AI 额度大幅提升',
  '优先体验最新 AI 能力',
  '更长上下文与更快响应',
]

/**
 * 超额升级占位 Dialog。全局挂载（App.tsx），由 `useUpgradeDialogStore` 控制开关。
 * 触发来源：AI 超额自动弹出、用户中心「升级」按钮。
 */
export function UpgradeDialog() {
  const open = useUpgradeDialogStore(s => s.open)
  const reason = useUpgradeDialogStore(s => s.reason)
  const resetAt = useUpgradeDialogStore(s => s.resetAt)
  const setOpen = useUpgradeDialogStore(s => s.setOpen)

  const title = reason === 'quota_exceeded' ? '今日 AI 额度已用完' : '升级 Pro，解锁更多 AI 额度'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            免费版每日 20 次 AI 额度，
            {formatResetTime(resetAt)}
            。升级 Pro 可获得更充裕的额度与更强能力。
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2 py-2">
          {PRO_BENEFITS.map(benefit => (
            <li key={benefit} className="flex items-center gap-2 text-sm">
              <Check className="size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{benefit}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">我知道了</Button>
          </DialogClose>
          <Button onClick={() => toast('敬请期待', { description: 'Pro 升级即将上线，感谢你的关注。' })}>
            <Sparkles />
            升级 Pro（即将上线）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
