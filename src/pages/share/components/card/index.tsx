import type { Ref } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Archive, ArrowUpRight, Clock3, Eye, FileUser, History, Link2, LockKeyhole, MessageSquareText, MoreHorizontal, Power, Settings2, Trash2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/date'
import { SHARE_MOTION, SHARE_STATUS_META } from '../../const'
import useShareStore from '../../store'
import { buildShareUrl, deriveShareStatus, formatShareUrlForDisplay } from '../../utils'
import CopyLinkButton from '../copy-link-button'
import VersionBadge from '../version-badge'

interface LinkCardProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
}

export default function LinkCard({ ref, share, index }: LinkCardProps) {
  const { pendingShareIds, openSettingsDialog, openArchiveDialog, openDeleteDialog, openVersionDialog, setActive } = useShareStore()
  const reduceMotion = useReducedMotion()
  const status = deriveShareStatus(share)
  const statusMeta = SHARE_STATUS_META[status]
  const url = buildShareUrl(share.token)
  const busy = pendingShareIds.includes(share.id)
  const archived = Boolean(share.archivedAt)
  const title = share.label || `${share.display_name || '简历'}的分享`
  const expiry = share.expires_at
    ? new Date(share.expires_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : null

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
    <PresenceDiv
      ref={ref}
      role="listitem"
      className="min-w-0"
      layout={reduceMotion ? false : 'position'}
      initial={reduceMotion ? false : SHARE_MOTION.item.initial}
      animate={SHARE_MOTION.item.animate}
      exit={{
        ...(reduceMotion ? { opacity: 0 } : SHARE_MOTION.item.exit),
        transition: { duration: reduceMotion ? 0 : DURATION.fast, delay: 0, ease: EASE.in },
      }}
      transition={{
        ...SHARE_MOTION.item.transition,
        duration: reduceMotion ? 0 : DURATION.base,
        delay: reduceMotion ? 0 : staggerDelay(Math.min(index, 6)),
        layout: reduceMotion ? { duration: 0 } : SPRING.layout,
      }}
    >
      <article
        aria-label={title}
        aria-busy={busy}
        className={cn(
          'group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-within:border-foreground/25',
          status === 'expired' && 'border-amber-200 dark:border-amber-900/60',
        )}
        style={{ transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s` }}
      >
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              <FileUser className="size-4" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold" title={title}>{title}</h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={share.display_name || '未命名简历'}>{share.display_name || '未命名简历'}</p>
            </div>
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`更多操作：${title}`} disabled={busy} className="text-muted-foreground">
                    {busy ? <Spinner /> : <MoreHorizontal className="size-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuItem disabled={busy || archived} onClick={() => openVersionDialog(share.id)}>
                      <History />
                      更换分享版本
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={busy || archived} onClick={handleToggleActive}>
                      <Power />
                      {share.is_active ? '关闭链接' : '启用链接'}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {!archived && (
                      <DropdownMenuItem disabled={busy} onClick={() => openArchiveDialog(share.id)}>
                        <Archive />
                        归档分享
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem variant="destructive" disabled={busy} onClick={() => openDeleteDialog(share.id)}>
                      <Trash2 />
                      永久删除
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', statusMeta.badgeClassName)}>
              <span className={cn('size-1.5 rounded-full', statusMeta.dotClassName)} />
              {statusMeta.label}
            </span>
            <div className="min-w-0"><VersionBadge source={share.source} /></div>
            {share.has_password && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted-foreground" title="密码保护">
                <LockKeyhole className="size-3" />
                <span className="sr-only">密码保护</span>
              </span>
            )}
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 pl-2.5 pr-0.5">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={url}>{formatShareUrlForDisplay(url)}</code>
            <CopyLinkButton url={url} />
          </div>

          <dl className="mt-3 grid grid-cols-2 divide-x">
            <div className="min-w-0 pr-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="size-3.5" />
                访问次数
              </dt>
              <dd className="mt-1 text-sm font-semibold leading-5 tabular-nums">{share.view_count.toLocaleString()}</dd>
            </div>
            <div className="min-w-0 pl-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                最近访问
              </dt>
              <dd className="mt-1 truncate text-xs leading-5" title={share.last_viewed_at ? new Date(share.last_viewed_at).toLocaleString('zh-CN') : undefined}>
                {share.last_viewed_at ? formatRelativeTime(share.last_viewed_at) : '暂无访问'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3.5" />
            {share.allowComments ? '允许评论' : '仅查看'}
          </span>
          <span title={share.expires_at ? new Date(share.expires_at).toLocaleString('zh-CN') : undefined}>
            {expiry ? `${expiry}${status === 'expired' ? '已到期' : '到期'}` : '无到期限制'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-3 py-2">
          <Button variant="ghost" className="h-8 rounded-md text-xs text-muted-foreground" disabled={busy || archived} onClick={() => openSettingsDialog(share.id)}>
            <Settings2 className="size-4" />
            编辑设置
          </Button>
          <Button variant="outline" className="h-8 rounded-md bg-card text-xs" disabled={archived} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            预览简历
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </article>
    </PresenceDiv>
  )
}
