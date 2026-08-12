import type { Ref } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Copy, Eye, LockKeyhole, MoreHorizontal, Power, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getResumeSnapshotById } from '@/lib/supabase/resume/share'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/date'
import { SHARE_CARD_ICONS, SHARE_ICON_STYLES, SHARE_MOTION, SHARE_STATUS_META } from '../../const'
import useShareStore from '../../store'
import { buildShareUrl, deriveShareStatus, formatShareUrlForDisplay } from '../../utils'

interface LinkCardProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
}

export default function LinkCard({ ref, share, index }: LinkCardProps) {
  const {
    pendingShareIds,
    openSettingsDialog,
    openDeleteDialog,
    pushSnapshot,
    setActive,
  } = useShareStore()
  const reduceMotion = useReducedMotion()
  const status = deriveShareStatus(share)
  const statusMeta = SHARE_STATUS_META[status]
  const Icon = SHARE_CARD_ICONS[index % SHARE_CARD_ICONS.length]
  const url = buildShareUrl(share.token)
  const busy = pendingShareIds.includes(share.id)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制')
    }
    catch {
      toast.error('复制失败，请手动复制')
    }
  }

  const handlePreview = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handlePushLatest = async () => {
    try {
      const source = await getResumeSnapshotById(share.resume_id)
      await pushSnapshot(
        share.id,
        source.snapshot,
        source.templateManifest,
        source.displayName,
      )
      toast.success('已推送最新版')
    }
    catch {
      toast.error('推送失败')
    }
  }

  const handleToggleActive = async () => {
    try {
      await setActive(share.id, !share.is_active)
      toast.success(share.is_active ? '链接已关闭' : '链接已启用')
    }
    catch {
      toast.error('操作失败')
    }
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
        delay: reduceMotion ? 0 : Math.min(index, 12) * 0.025,
        layout: { duration: reduceMotion ? 0 : 0.2 },
      }}
      className="min-w-0"
    >
      <Card className={cn(
        'min-w-0 gap-0 overflow-hidden rounded-xl py-0 shadow-sm transition-colors hover:border-primary/25',
        status === 'inactive' && 'bg-muted/30 opacity-75',
        status === 'expired' && 'border-red-200 dark:border-red-900',
      )}
      >
        <div className="min-w-0 p-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                SHARE_ICON_STYLES[index % SHARE_ICON_STYLES.length],
              )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{share.label || '未命名链接'}</h3>
                <p className="truncate text-[11px] text-muted-foreground">{share.display_name || '未命名简历'}</p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('mt-1 size-2 shrink-0 rounded-full', statusMeta.dotClassName)} />
              </TooltipTrigger>
              <TooltipContent>{statusMeta.label}</TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md bg-muted/60 px-2 py-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <code className="block min-w-0 truncate text-[10px] text-muted-foreground">
                  {formatShareUrlForDisplay(url)}
                </code>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all">{url}</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon-xs" aria-label="复制链接" onClick={handleCopy}>
              <Copy data-icon="inline-start" />
            </Button>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-3 text-[11px] text-muted-foreground">
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
            <span className="min-w-0 truncate">
              {share.last_viewed_at ? formatRelativeTime(share.last_viewed_at) : '暂无访问'}
            </span>
          </div>

          <div className="mt-3 flex justify-end gap-1 border-t pt-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="预览" onClick={handlePreview}>
                  <Eye data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>预览</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="编辑设置" disabled={busy} onClick={() => openSettingsDialog(share.id)}>
                  <Settings2 data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑设置</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="更多操作">
                  <MoreHorizontal data-icon="inline-start" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={busy} onClick={handlePushLatest}>
                    <RefreshCw data-icon="inline-start" />
                    推送最新版
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={busy} onClick={handleToggleActive}>
                    <Power data-icon="inline-start" />
                    {share.is_active ? '关闭链接' : '启用链接'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => openDeleteDialog(share.id)}>
                    <Trash2 data-icon="inline-start" />
                    永久删除
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
