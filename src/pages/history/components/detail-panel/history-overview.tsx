import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { Bookmark, Briefcase, CalendarClock, Flag, MessageSquareText, Send, Tags } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/utils/date'
import { SOURCE_META } from '../../const'
import { useJobSummaries } from '../../hooks/use-job-summaries'
import VersionMetadataFields from '../shared/version-metadata-fields'
import MetricCard from './metric-card'

interface HistoryVersionOverviewProps {
  state: HistoryDetailPanelState
}

export default function HistoryVersionOverview({ state }: HistoryVersionOverviewProps) {
  const { selectedVersion: version, editing } = state
  const { getLabel } = useJobSummaries()

  if (!version) {
    return null
  }

  if (editing) {
    return (
      <Card className="gap-0 py-0">
        <CardContent className="px-5 py-5">
          <VersionMetadataFields draft={state.editDraft} onChange={state.updateEditDraft} />
        </CardContent>
      </Card>
    )
  }

  const jobLabel = getLabel(version.company_id)
  const jobValue = jobLabel ?? (version.company_id ? '岗位已删除' : '未关联')

  return (
    <>
      <Card className="gap-4 border-border/70 bg-muted/20 py-5 shadow-none">
        <CardContent className="grid gap-3 px-5 sm:grid-cols-2">
          <MetricCard label="版本号" value={`V${version.version_no}`} icon={Bookmark} toneClassName="border-primary/10 bg-primary/5" />
          <MetricCard
            label="版本来源"
            value={SOURCE_META[version.source_type].label}
            icon={SOURCE_META[version.source_type].icon}
            toneClassName="border-accent bg-accent/40"
          />
          <MetricCard
            label="创建时间"
            value={formatDateTime(version.created_at)}
            icon={CalendarClock}
            toneClassName="border-secondary bg-secondary/40"
          />
          <MetricCard
            label="重点标记"
            value={version.milestone_name || '未设置'}
            icon={Flag}
            toneClassName="border-border bg-muted/40"
          />
          <MetricCard
            label="关联岗位"
            value={jobValue}
            icon={Briefcase}
            toneClassName="border-border bg-muted/40"
          />
          <MetricCard
            label="投递日期"
            value={version.submitted_at || '未记录'}
            icon={Send}
            toneClassName="border-border bg-muted/40"
          />
        </CardContent>
      </Card>

      <Card className="gap-4 border-border/70 py-5 shadow-none">
        <CardContent className="flex flex-col gap-3 px-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquareText className="size-4 text-primary" />
              版本说明
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {version.description || '暂无说明'}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tags className="size-4 text-primary" />
              标签
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(version.tags?.length ?? 0) > 0
                ? version.tags?.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                : <span className="text-sm text-muted-foreground">暂无标签</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
