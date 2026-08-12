import type { ShareVersionSource } from '@/lib/supabase/resume/share.types'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatShareVersionSource } from '../../utils'

export default function VersionBadge({ source }: { source: ShareVersionSource }) {
  const badge = (
    <Badge variant="outline" className="max-w-full font-normal text-muted-foreground">
      <History className="size-3" />
      <span className="truncate">{formatShareVersionSource(source)}</span>
    </Badge>
  )

  if (source.kind !== 'history' || source.versionId != null)
    return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>原历史版本已删除，链接仍保留发布时的快照</TooltipContent>
    </Tooltip>
  )
}
