import { CloudUpload, GitBranch, Plane, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'

function HeadBars() {
  const isOnline = useResumeListStore(s => s.isOnline)
  const offlineResumes = useResumeListStore(s => s.offlineResumes)
  const resumes = useResumeListStore(s => s.resumes)
  const setShowSyncDialog = useResumeListStore(s => s.setShowSyncDialog)
  const setDerivedJobsOpen = useResumeListStore(s => s.setDerivedJobsOpen)
  const hasOfflineResumesToSync = isOnline && offlineResumes.length > 0
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
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">我的简历</h1>
        <p className="text-muted-foreground">管理和编辑你的简历</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
        <Badge variant={isOnline ? 'secondary' : 'outline'} className="self-start sm:self-auto">
          {isOnline ? <Wifi /> : <Plane />}
          {isOnline ? '在线' : '离线'}
        </Badge>
        <Button
          onClick={() => setDerivedJobsOpen(true)}
          variant="ghost"
          size="sm"
          className="w-full sm:w-auto"
          disabled={pendingCount === 0}
        >
          <GitBranch data-icon="inline-start" />
          派生任务
          {pendingCount > 0 && (
            <Badge variant="secondary">{pendingCount}</Badge>
          )}
        </Button>
        <Button
          onClick={() => setShowSyncDialog(true)}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!hasOfflineResumesToSync}
        >
          <CloudUpload data-icon="inline-start" />
          同步本地简历 (
          {offlineResumes.length}
          )
        </Button>
      </div>
    </div>
  )
}

export default HeadBars
