import type { ShareVersionSource } from '@/lib/supabase/resume/share.types'
import { History, Pin, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatShareVersionSource } from '../../utils'

export default function VersionBadge({
  source,
  appearance = 'badge',
}: {
  source: ShareVersionSource
  appearance?: 'badge' | 'plain'
}) {
  const badge =
    appearance === 'plain' ? (
      <span
        className='inline-flex min-w-0 items-center gap-1.5 text-xs'
        title={
          source.kind === 'history'
            ? source.versionLabel
            : '跟随云端已保存的简历内容更新'
        }
      >
        {source.kind === 'current' ? (
          <RefreshCw
            className='size-3.5 shrink-0 text-muted-foreground'
            aria-hidden
          />
        ) : (
          <Pin
            className='size-3.5 shrink-0 text-muted-foreground'
            aria-hidden
          />
        )}
        <span className='truncate'>
          {source.kind === 'current'
            ? '随保存更新'
            : `固定版本 · V${source.versionNo}`}
        </span>
      </span>
    ) : (
      <Badge
        variant='outline'
        className='max-w-full font-normal text-muted-foreground'
      >
        <History className='size-3' />
        <span className='truncate'>{formatShareVersionSource(source)}</span>
      </Badge>
    )

  if (source.kind !== 'history' || source.versionId != null) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>原历史版本已删除，链接仍保留发布时的快照</TooltipContent>
    </Tooltip>
  )
}
