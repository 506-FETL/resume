import type { Ref } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Check, Copy, KeyRound, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime } from '@/utils/date'
import useShareStore from '../../store'
import { buildShareUrl, formatShareUrlForDisplay } from '../../utils'
import VersionBadge from '../version-badge'

interface LinkRowProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  busy: boolean
}

export function LinkRow({
  ref,
  share,
  busy,
}: LinkRowProps) {
  const {
    setActive,
    openVersionDialog,
    openSettingsDialog,
    openDeleteDialog,
  } = useShareStore()
  const reduceMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const url = buildShareUrl(share.token)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('链接已复制')
      if (resetTimerRef.current)
        clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => setCopied(false), 1500)
    }
    catch {
      toast.error('复制失败，请手动复制链接')
    }
  }

  const handleToggleActive = async (isActive: boolean) => {
    try {
      await setActive(share.id, isActive)
      toast.success(isActive ? '链接已启用' : '链接已关闭')
    }
    catch {
      toast.error('操作失败')
    }
  }

  useEffect(() => () => {
    if (resetTimerRef.current)
      clearTimeout(resetTimerRef.current)
  }, [])

  const expired = share.expires_at ? new Date(share.expires_at).getTime() < Date.now() : false

  return (
    <motion.div
      ref={ref}
      layout
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
      transition={{
        duration: reduceMotion ? 0 : 0.18,
        ease: [0.22, 1, 0.36, 1],
        layout: { duration: reduceMotion ? 0 : 0.2 },
      }}
      className="min-w-0 shrink-0 flex flex-col gap-2 overflow-hidden rounded-lg border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium">{share.label || '未命名链接'}</span>
          {share.has_password && (
            <Badge variant="outline">
              <KeyRound className="size-3" />
              密码
            </Badge>
          )}
          {expired && <Badge variant="destructive">已过期</Badge>}
          {!share.is_active && <Badge variant="secondary">已关闭</Badge>}
          <VersionBadge source={share.source} />
        </div>
        <Switch checked={share.is_active} disabled={busy} onCheckedChange={handleToggleActive} aria-label="启用或关闭链接" />
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <code className="block min-w-0 truncate rounded bg-muted px-2 py-1 text-xs">
              {formatShareUrlForDisplay(url)}
            </code>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-all">{url}</TooltipContent>
        </Tooltip>
        <Button size="icon-sm" variant="ghost" onClick={handleCopy} aria-label="复制链接">
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          打开
          {' '}
          {share.view_count}
          {' '}
          次
        </span>
        {share.last_viewed_at && (
          <span>
            最后查看
            {' '}
            {formatDateTime(new Date(share.last_viewed_at).getTime())}
          </span>
        )}
        {share.expires_at && !expired && (
          <span>
            有效至
            {' '}
            {formatDateTime(new Date(share.expires_at).getTime())}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        <Button size="xs" variant="outline" disabled={busy} onClick={() => openSettingsDialog(share.id)}>
          <Pencil data-icon="inline-start" />
          编辑设置
        </Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={() => openVersionDialog(share.id)}>
          <RefreshCw data-icon="inline-start" />
          更换分享版本
        </Button>
        <Button size="xs" variant="destructive" disabled={busy} onClick={() => openDeleteDialog(share.id)}>
          <Trash2 data-icon="inline-start" />
          删除
        </Button>
      </div>
    </motion.div>
  )
}
