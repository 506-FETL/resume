import { Clock3, FileText, History, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/utils/date'
import useHistoryStore from '../../store'
import { getCurrentSyncState, getResumeTypeLabel } from '../../utils'
import MetricCard from './metric-card'

export default function CurrentOverview() {
  const { currentResume, versions } = useHistoryStore()

  if (!currentResume) {
    return null
  }

  const syncState = getCurrentSyncState(currentResume, versions)

  return (
    <>
      <Card className="gap-0 rounded-lg border-border/70 py-3 shadow-none">
        <CardContent className="grid gap-3 px-5 sm:grid-cols-3">
          <MetricCard label="当前模板" value={getResumeTypeLabel(currentResume.type)} icon={FileText} />
          <MetricCard label="版本数量" value={`${versions.length}`} icon={History} />
          <MetricCard
            label="最近更新"
            value={currentResume.updatedAt ? formatRelativeTime(currentResume.updatedAt) : '未知'}
            icon={Clock3}
          />
        </CardContent>
      </Card>

      <Card className="gap-3 rounded-lg border-border/70 bg-muted/20 py-4 shadow-none">
        <CardContent className="px-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="size-4 text-primary" />
            当前状态
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {versions.length === 0
              ? '当前简历尚未保存版本。'
              : syncState.synced
                ? `当前内容与最近保存的 V${syncState.latestVersionNo} 一致。`
                : '当前内容与最近保存的版本不同。'}
          </p>
        </CardContent>
      </Card>
    </>
  )
}
