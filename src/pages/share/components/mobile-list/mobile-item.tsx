import type { Ref } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Copy, Eye, LockKeyhole } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SHARE_CARD_ICONS, SHARE_ICON_STYLES, SHARE_MOTION, SHARE_STATUS_META } from '../../const'
import { buildShareUrl, deriveShareStatus, formatShareUrlForDisplay } from '../../utils'

interface MobileItemProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
  onOpen: (trigger: HTMLElement) => void
}

export default function MobileItem({
  ref,
  share,
  index,
  onOpen,
}: MobileItemProps) {
  const reduceMotion = useReducedMotion()
  const status = deriveShareStatus(share)
  const statusMeta = SHARE_STATUS_META[status]
  const Icon = SHARE_CARD_ICONS[index % SHARE_CARD_ICONS.length]
  const url = buildShareUrl(share.token)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    }
    catch {
      toast.error('复制失败，请手动复制')
    }
  }

  const handleOpen = (trigger: HTMLElement) => {
    trigger.blur()
    requestAnimationFrame(() => onOpen(trigger))
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={reduceMotion ? false : SHARE_MOTION.item.initial}
      animate={SHARE_MOTION.item.animate}
      exit={reduceMotion ? { opacity: 0 } : SHARE_MOTION.item.exit}
      transition={{
        ...SHARE_MOTION.item.transition,
        duration: reduceMotion ? 0 : SHARE_MOTION.item.transition.duration,
        delay: reduceMotion ? 0 : Math.min(index, 12) * 0.02,
        layout: { duration: reduceMotion ? 0 : 0.2 },
      }}
    >
      <Card
        role="button"
        tabIndex={0}
        className={cn(
          'min-w-0 cursor-pointer gap-0 overflow-hidden rounded-xl p-3 py-3 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          status === 'inactive' && 'bg-muted/30 opacity-75',
          status === 'expired' && 'border-red-200 dark:border-red-900',
        )}
        onClick={event => handleOpen(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget)
            return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleOpen(event.currentTarget)
          }
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            SHARE_ICON_STYLES[index % SHARE_ICON_STYLES.length],
          )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{share.label || '未命名链接'}</h3>
              <span className={cn('size-2 shrink-0 rounded-full', statusMeta.dotClassName)} />
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {share.display_name || '未命名简历'}
              {share.has_password ? ' · 密码保护' : ''}
              {' · '}
              打开
              {share.view_count}
              次
            </p>
          </div>
        </div>

        <div className="mt-2.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md bg-muted/60 px-2 py-1.5">
          <code className="block min-w-0 truncate text-[10px] text-muted-foreground">
            {formatShareUrlForDisplay(url)}
          </code>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="复制链接"
            onClick={(event) => {
              event.stopPropagation()
              handleCopy()
            }}
          >
            <Copy data-icon="inline-start" />
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          {share.has_password && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <LockKeyhole className="size-3" />
              密码
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" />
            {share.view_count}
          </span>
        </div>
      </Card>
    </motion.div>
  )
}
