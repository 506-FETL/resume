import type { HistoryDetailPanelState } from './use-detail-panel-state'
import { Briefcase, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingRegion } from '@/components/loading-skeleton'
import { useJobSummaries } from '../../hooks/use-job-summaries'
import HistoryMotionContent from '../motion-content'
import VersionMetadataFields from '../shared/version-metadata-fields'
import MetricCard from './metric-card'

interface HistoryVersionOverviewProps {
  state: HistoryDetailPanelState
}

export default function HistoryVersionOverview({
  state,
}: HistoryVersionOverviewProps) {
  const { selectedVersion: version, editing } = state
  const { getLabel, loading, error, retry } = useJobSummaries()

  if (!version) {
    return null
  }

  const jobLabel = getLabel(version.company_id)

  const jobValue = !version.company_id ? (
    '未关联岗位'
  ) : loading && !jobLabel ? (
    <LoadingRegion label='正在加载关联岗位'>
      <Skeleton className='h-4 w-24' />
    </LoadingRegion>
  ) : (
    (jobLabel ?? '岗位信息暂不可用')
  )

  return (
    <HistoryMotionContent transitionKey={editing ? 'editing' : 'overview'}>
      {editing ? (
        <div className='min-w-0 py-1'>
          <VersionMetadataFields
            draft={state.editDraft}
            onChange={state.updateEditDraft}
          />
        </div>
      ) : (
        <div className='grid min-w-0 gap-4'>
          <dl className='grid min-w-0 gap-4'>
            <div>
              <dt className='text-xs text-muted-foreground'>版本说明</dt>
              <dd className='mt-1.5 break-words text-sm leading-6'>
                {version.description || (
                  <span className='text-muted-foreground'>暂无说明</span>
                )}
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>标签</dt>
              <dd className='mt-1.5 flex flex-wrap gap-1.5'>
                {(version.tags?.length ?? 0) > 0 ? (
                  version.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant='secondary'
                      className='max-w-full whitespace-normal break-words'
                    >
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className='text-sm text-muted-foreground'>
                    暂无标签
                  </span>
                )}
              </dd>
            </div>
          </dl>
          <div className='grid min-w-0 gap-x-6 gap-y-1 sm:grid-cols-2'>
            <MetricCard label='关联岗位' value={jobValue} icon={Briefcase} />
            <MetricCard
              label='投递日期'
              value={version.submitted_at || '未记录'}
              icon={Send}
            />
          </div>
          {error && version.company_id && (
            <div className='flex items-center gap-2 text-sm' role='alert'>
              <span className='text-muted-foreground'>{error}</span>
              <Button type='button' variant='ghost' size='sm' onClick={retry}>
                重试
              </Button>
            </div>
          )}
        </div>
      )}
    </HistoryMotionContent>
  )
}
