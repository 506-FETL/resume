import type { MouseEventHandler } from 'react'
import type { ResumeItem } from '../../types'
import { CloudUpload, GitBranch, Plane, Plus, Wifi } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'

function HeadBars({ onCreate, resumes, isOnline, offlineCount }: { onCreate: MouseEventHandler<HTMLButtonElement>, resumes: ResumeItem[], isOnline: boolean, offlineCount: number }) {
  const setShowSyncDialog = useResumeListStore(s => s.setShowSyncDialog)
  const setDerivedJobsOpen = useResumeListStore(s => s.setDerivedJobsOpen)
  const hasOfflineResumesToSync = isOnline && offlineCount > 0
  const tasks = useJdVariantStore(s => s.tasks)
  // 与“派生任务”弹窗口径一致：store 仅计进行中（parsing/rewriting），失败/取消由 DB failed 行体现
  const activeParentIds = new Set(
    Object.values(tasks)
      .filter(t => t.phase === 'parsing' || t.phase === 'rewriting')
      .map(t => t.parentResumeId),
  )
  const dbPendingParentIds = new Set(
    resumes
      .filter(r => r.derived_status === 'generating' || r.derived_status === 'failed')
      .map(r => r.parent_resume_id ?? '')
      .filter(pid => pid !== '' && !activeParentIds.has(pid)),
  )
  const pendingCount = activeParentIds.size + dbPendingParentIds.size

  return (
    <PageHeader
      title="我的简历"
      description={`${resumes.length} 份简历`}
      actions={(
        <Button aria-label="打开创建简历表单" onClick={onCreate}>
          <Plus />
          创建简历
        </Button>
      )}
    >

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isOnline ? 'secondary' : 'outline'} className="self-start sm:self-auto">
          {isOnline ? <Wifi /> : <Plane />}
          {isOnline ? '在线' : '离线'}
        </Badge>
        {pendingCount > 0 && (
          <Button
            onClick={() => setDerivedJobsOpen(true)}
            variant="ghost"
            size="sm"
            className="w-auto"
            disabled={pendingCount === 0}
          >
            <GitBranch data-icon="inline-start" />
            派生任务
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount}</Badge>
            )}
          </Button>
        )}
        {hasOfflineResumesToSync && (
          <Button
            onClick={() => setShowSyncDialog(true)}
            variant="outline"
            size="sm"
            className="w-auto"
            disabled={!hasOfflineResumesToSync}
          >
            <CloudUpload data-icon="inline-start" />
            同步本地简历 (
            {offlineCount}
            )
          </Button>
        )}
      </div>
    </PageHeader>
  )
}

export default HeadBars
