import { useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
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
import { useAiQuota } from '@/hooks/use-ai-quota'
import useUpgradeDialogStore from '@/store/upgrade-dialog'
import { formatResetTime } from './utils'

/**
 * 额度说明。保留原调用入口，供超额提示与用户中心共用。
 */
export function UpgradeDialog() {
  const open = useUpgradeDialogStore((s) => s.open)
  const reason = useUpgradeDialogStore((s) => s.reason)
  const setOpen = useUpgradeDialogStore((s) => s.setOpen)
  const { quota, loading, error, refetch } = useAiQuota()
  const reduceMotion = useReducedMotion()
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const title =
    reason === 'quota_exceeded' ? '剩余额度不够完成这次操作' : 'AI 额度说明'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md'
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
        onOpenAutoFocus={() => {
          // 全局弹窗通过 store 打开，没有关联的 DialogTrigger。
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault()
            returnFocusRef.current.focus({ preventScroll: true })
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            使用 AI 会消耗额度，编辑和导出简历不受影响。
          </DialogDescription>
        </DialogHeader>

        <AnimatedContent
          animationKey={
            loading ? 'loading' : error || !quota ? 'unavailable' : 'ready'
          }
        >
          <div className='rounded-lg border bg-muted/30 p-4 text-sm leading-6'>
            {loading ? (
              <p role='status' className='text-muted-foreground'>
                正在查询额度…
              </p>
            ) : error || !quota ? (
              <p role='status' className='text-muted-foreground'>
                没能加载额度，请重试。
              </p>
            ) : quota.unlimited ? (
              <p>你的账户不限每日额度。</p>
            ) : (
              <>
                <p className='font-medium'>
                  今日剩余 {quota.remaining} / {quota.dailyLimit} 点额度
                </p>
                <p className='mt-1 text-muted-foreground'>
                  {formatResetTime(quota.resetAt)}
                </p>
              </>
            )}
          </div>
        </AnimatedContent>
        <p className='text-xs text-muted-foreground'>暂时不能购买额外额度。</p>
        <DialogFooter>
          <Button
            variant='outline'
            disabled={loading}
            onClick={() => {
              refetch()
            }}
          >
            {loading ? '查询中…' : '刷新额度'}
          </Button>
          <DialogClose asChild>
            <Button>我知道了</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
