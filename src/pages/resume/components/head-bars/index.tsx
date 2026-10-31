import type { MouseEventHandler } from 'react'
import { Cloud, CloudUpload, GitBranch, HardDrive, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'
import { RESUME_BADGE_COLORS } from '../resume-card/const'

function HeadBars({
  onCreate,
  counts,
  isOnline,
  offlineCount,
}: {
  onCreate: MouseEventHandler<HTMLButtonElement>
  counts: {
    all: number
    cloud: number
    local: number
    variant: number
    pending: number
  } | null
  isOnline: boolean
  offlineCount: number
}) {
  const setShowSyncDialog = useResumeListStore((s) => s.setShowSyncDialog)
  const setDerivedJobsOpen = useResumeListStore((s) => s.setDerivedJobsOpen)
  const hasOfflineResumesToSync = isOnline && offlineCount > 0
  const tasks = useJdVariantStore((s) => s.tasks)

  const hasPendingTasks =
    (counts?.pending ?? 0) > 0 ||
    Object.values(tasks).some(
      (task) => task.phase === 'parsing' || task.phase === 'rewriting',
    )

  const resumeTags = [
    { tone: 'cloud', label: '云端', icon: Cloud },
    { tone: 'local', label: '本地', icon: HardDrive },
    { tone: 'variant', label: '岗位版本', icon: GitBranch },
  ] as const

  return (
    <PageHeader
      title='我的简历'
      description={counts ? `${counts.all} 份简历` : '简历数量暂不可用'}
      actions={
        <Button aria-label='打开创建简历表单' onClick={onCreate}>
          <Plus />
          创建简历
        </Button>
      }
    >
      <div className='flex flex-wrap items-center gap-2'>
        <AnimatedContent animationKey={isOnline ? 'online' : 'offline'}>
          <div className='flex flex-wrap items-center gap-1.5'>
            {isOnline ? (
              resumeTags.map(({ tone, label, icon: Icon }) => (
                <Badge
                  key={tone}
                  variant='outline'
                  className={RESUME_BADGE_COLORS[tone]}
                  aria-label={`${label}简历 ${counts?.[tone] ?? '未知'} 份`}
                >
                  <Icon aria-hidden />
                  {label}
                  <span className='tabular-nums'>{counts?.[tone] ?? '—'}</span>
                </Badge>
              ))
            ) : (
              <Badge variant='outline'>
                <HardDrive aria-hidden />
                本地保存
              </Badge>
            )}
          </div>
        </AnimatedContent>
        {hasPendingTasks && (
          <Button
            onClick={() => setDerivedJobsOpen(true)}
            variant='ghost'
            size='sm'
            className='w-auto'
          >
            <GitBranch data-icon='inline-start' />
            岗位版本任务
          </Button>
        )}
        {hasOfflineResumesToSync && (
          <Button
            onClick={() => setShowSyncDialog(true)}
            variant='outline'
            size='sm'
            className='w-auto'
            disabled={!hasOfflineResumesToSync}
          >
            <CloudUpload data-icon='inline-start' />
            同步本地简历 ({offlineCount})
          </Button>
        )}
      </div>
    </PageHeader>
  )
}

export default HeadBars
