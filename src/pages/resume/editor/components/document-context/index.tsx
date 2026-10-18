import { CircleCheck, Cloud, HardDrive } from 'lucide-react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import useResumeStore from '@/store/resume/form'
import { useResumeReviewStore } from '../../review-store'

export function DocumentContext() {
  const resumeId = useCurrentResumeStore(state => state.resumeId)
  const title = useResumeListStore(state => state.resumes.find(resume => resume.resume_id === resumeId)?.display_name)
  const name = useResumeStore(state => state.basics.name)
  const mode = useResumeStore(state => state.mode)
  const isSyncing = useResumeStore(state => state.isSyncing)
  const syncError = useResumeStore(state => state.syncError)
  const pendingChanges = useResumeStore(state => state.pendingChanges)
  const lastSyncTime = useResumeStore(state => state.lastSyncTime)
  const reviewActive = useResumeReviewStore(state => state.active)
  const status = reviewActive ? '只读审阅' : isSyncing ? '正在保存' : syncError ? '保存失败，请重试' : pendingChanges ? '有待保存更改' : lastSyncTime ? '已保存' : '工作版本'

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/90 px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {mode === 'offline' ? <HardDrive className="size-4 shrink-0 text-muted-foreground" /> : <Cloud className="size-4 shrink-0 text-muted-foreground" />}
        <h1 className="truncate text-sm font-medium">{title || name || '当前简历'}</h1>
      </div>
      <span role="status" className="shrink-0">
        <AnimatedContent as="span" animationKey={status} className={cn('flex items-center gap-1.5 text-xs', syncError && !reviewActive ? 'text-destructive' : 'text-muted-foreground')}>
          {!reviewActive && !pendingChanges && !isSyncing && !syncError && lastSyncTime ? <CircleCheck className="size-3.5" /> : null}
          {status}
        </AnimatedContent>
      </span>
    </div>
  )
}
