import type { ShareVersionSource } from '@/lib/supabase/resume/share.types'
import { History, Pin, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
      <span className='inline-flex min-w-0 items-center gap-1.5 text-xs'>
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

  return badge
}
