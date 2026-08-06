import type { CanvasModel } from '../../../types'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { listResumeHistoryVersions } from '@/lib/supabase/resume'
import useAssistantStore from '../../../store'

export default function VersionTimeline({ model }: { model: CanvasModel }) {
  const previewResumeId = useAssistantStore(s => s.previewResumeId)
  const [versions, setVersions] = useState<Array<Record<string, unknown>> | null>(null)
  // 同 BoardSnapshot：只在写操作「已应用」后刷新，避免 awaiting-confirm 阶段读旧数据后不再更新
  const versionWriteCount = model.writes.filter(w => w.category === 'version' && w.state === 'result').length

  useEffect(() => {
    if (!previewResumeId) {
      setVersions([])
      return
    }
    listResumeHistoryVersions(previewResumeId)
      .then(rows => setVersions(rows as unknown as Array<Record<string, unknown>>))
      .catch(() => setVersions([]))
  }, [previewResumeId, versionWriteCount])

  if (!versions) {
    return (
      <div className="p-3">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <Empty>
        <EmptyHeader><EmptyTitle>暂无历史版本</EmptyTitle></EmptyHeader>
      </Empty>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <ol className="flex flex-col gap-2 p-3">
        {versions.map(v => (
          <li key={String(v.id)} className="rounded-lg border bg-background p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                V
                {String(v.version_no)}
              </span>
              <span className="text-xs text-muted-foreground">{dayjs(String(v.created_at)).format('MM-DD HH:mm')}</span>
            </div>
            {v.milestone_name ? <p className="text-xs text-muted-foreground">{String(v.milestone_name)}</p> : null}
          </li>
        ))}
      </ol>
    </ScrollArea>
  )
}
