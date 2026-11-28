import type { MouseEventHandler, Ref } from 'react'
import { Cloud, CloudUpload, GitBranch, HardDrive, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'
import { RESUME_BADGE_COLORS } from '../resume-card/const'

function HeadBars({
  authPending,
  onCreate,
  counts,
  isOnline,
  offlineCount,
  createButtonRef,
}: {
  authPending: boolean
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
  createButtonRef?: Ref<HTMLButtonElement>
}) {
  const libraryCountsError = useResumeListStore((s) => s.libraryCountsError)
  const libraryCountsLoading = useResumeListStore((s) => s.libraryCountsLoading)
  const loadLibraryCounts = useResumeListStore((s) => s.loadLibraryCounts)

  const setShowSyncDialog = useResumeListStore((s) => s.setShowSyncDialog)
  const setDerivedJobsOpen = useResumeListStore((s) => s.setDerivedJobsOpen)
  const hasOfflineResumesToSync = isOnline && offlineCount > 0

  const running = useJdVariantStore((s) =>
    Object.values(s.tasks).some(
      (task) => task.phase === 'parsing' || task.phase === 'rewriting',
    ),
  )

  const hasPendingTasks =
    !authPending && ((counts?.pending ?? 0) > 0 || running)

  const resumeTags = [
    { tone: 'cloud', label: '云端', icon: Cloud },
    { tone: 'local', label: '本地', icon: HardDrive },
    { tone: 'variant', label: '岗位版本', icon: GitBranch },
  ] as const

  return (
    <div className='[@media(max-height:500px)]:[&_header_p]:text-xs'>
      <PageHeader
        layout='compact'
        title='我的简历'
        description={
          <span
            className='inline-block min-w-[4em] whitespace-nowrap tabular-nums'
            aria-label={counts ? `${counts.all} 份简历` : '简历数量暂不可用'}
          >
            {counts?.all ?? '—'} 份
          </span>
        }
        actions={
          <Button
            ref={createButtonRef}
            aria-label='打开创建简历表单'
            disabled={authPending}
            onClick={onCreate}
          >
            <Plus />
            创建简历
          </Button>
        }
      >
        <div className='flex flex-wrap items-center gap-2'>
          {authPending ? (
            <Skeleton className='h-5 w-48 max-w-full' />
          ) : (
            <div>
              <div className='flex flex-wrap items-center gap-1.5'>
                {isOnline ? (
                  resumeTags.map(({ tone, label, icon: Icon }) => (
                    <Badge
                      key={tone}
                      variant='outline'
                      className={cn(
                        RESUME_BADGE_COLORS[tone],
                        '[@media(max-height:500px)]:px-1',
                      )}
                      aria-label={`${label}简历 ${counts?.[tone] ?? '未知'} 份`}
                    >
                      <Icon
                        aria-hidden
                        className='[@media(max-height:500px)]:hidden'
                      />
                      {label}
                      <span className='min-w-[2ch] text-center tabular-nums'>
                        {counts?.[tone] ?? '—'}
                      </span>
                    </Badge>
                  ))
                ) : (
                  <Badge variant='outline'>
                    <HardDrive aria-hidden />
                    本地保存
                  </Badge>
                )}
              </div>
            </div>
          )}
          {hasPendingTasks && (
            <Button
              onClick={() => setDerivedJobsOpen(true)}
              variant='ghost'
              size='sm'
              className='w-auto [@media(max-height:500px)]:size-9 [@media(max-height:500px)]:p-0'
              aria-label='岗位版本任务'
            >
              <GitBranch data-icon='inline-start' />
              <span className='[@media(max-height:500px)]:sr-only'>
                岗位版本任务
              </span>
            </Button>
          )}
          {hasOfflineResumesToSync && (
            <Button
              onClick={() => setShowSyncDialog(true)}
              variant='outline'
              size='sm'
              className='w-auto [@media(max-height:500px)]:size-9 [@media(max-height:500px)]:p-0'
              aria-label={`同步本地简历 (${offlineCount})`}
              disabled={!hasOfflineResumesToSync}
            >
              <CloudUpload data-icon='inline-start' />
              <span className='[@media(max-height:500px)]:sr-only'>
                同步本地简历 ({offlineCount})
              </span>
            </Button>
          )}
        </div>
      </PageHeader>
      <AnimatedContent animationKey={libraryCountsError ? 'error' : 'ready'}>
        {libraryCountsError && (
          <div
            role='alert'
            className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'
          >
            <span>简历数量读取失败，列表仍可继续加载。</span>
            <Button
              size='sm'
              variant='outline'
              disabled={libraryCountsLoading}
              onClick={() => loadLibraryCounts()}
            >
              重试统计
            </Button>
          </div>
        )}
      </AnimatedContent>
    </div>
  )
}

export default HeadBars
