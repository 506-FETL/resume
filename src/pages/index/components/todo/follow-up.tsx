import type { ResumeSpotlight } from './use-resume-spotlights'
import { BriefcaseBusiness, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { RotatingSlot } from './rotating-slot'

interface FollowUpModuleProps {
  items: ResumeSpotlight[]
  activeIndex: number
  loading: boolean
  onSelectIndex: (index: number) => void
}

export function FollowUpModule({
  items,
  activeIndex,
  loading,
  onSelectIndex: _onSelectIndex,
}: FollowUpModuleProps) {
  const navigate = useNavigate()
  const activeItem = items[activeIndex] ?? null

  return (
    <div className="relative flex h-full flex-col">
      <div className="absolute top-1 bottom-0 -left-2 hidden w-px bg-border/50 md:block" />
      <div className="mb-2.5 flex items-center gap-2">
        <Send className="size-3.5 text-emerald-500" />
        <h4 className="text-xs font-medium">投递跟进</h4>
      </div>
      <div className="flex h-full flex-col rounded-lg border border-emerald-100/80 bg-emerald-50/80 p-3 dark:border-emerald-900/20 dark:bg-emerald-950/20">
        <div className="min-h-18 flex-1">
          <RotatingSlot
            activeKey={loading ? 'loading' : activeItem?.resume.resume_id ?? 'empty'}
            className="min-h-18"
            contentClassName="gap-1.5"
          >
            {loading
              ? (
                  <>
                    <p className="text-[10px] text-emerald-700/75 dark:text-emerald-400/80">正在切换简历状态...</p>
                    <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90">正在加载投递进度</p>
                  </>
                )
              : activeItem
                ? (
                    <>
                      <p className="truncate text-[10px] font-medium text-emerald-700/75 dark:text-emerald-400/80">
                        {activeItem.resume.display_name || '未命名简历'}
                      </p>
                      {activeItem.tracker.pendingCount > 0
                        ? (
                            <div className="flex items-start gap-2">
                              <span className="relative mt-1.5 flex size-1.5 shrink-0">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                              </span>
                              <p className="text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-400/90">
                                有
                                {' '}
                                <span className="font-semibold text-sm">{activeItem.tracker.pendingCount}</span>
                                {' '}
                                个岗位超过
                                <span className="font-semibold"> 7 </span>
                                天没跟进
                              </p>
                            </div>
                          )
                        : (
                            <p className="text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-400/90">
                              {activeItem.tracker.jobCount > 0 ? '所有岗位跟进状态良好 ✓' : '暂无投递记录'}
                            </p>
                          )}
                      {activeItem.tracker.latestJob && (
                        <p className="text-[10px] text-muted-foreground">
                          最近更新：
                          {' '}
                          {activeItem.tracker.latestJob.company}
                          {' '}
                          ·
                          {' '}
                          {activeItem.tracker.latestJob.position}
                        </p>
                      )}
                    </>
                  )
                : (
                    <>
                      <p className="text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-400/90">
                        暂无可关联的云端简历
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        关联投递记录后，这里会按简历轮播展示进度。
                      </p>
                    </>
                  )}
          </RotatingSlot>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2.5 h-7 w-full border-emerald-200/80 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
          onClick={() => navigate('/tracker')}
        >
          <BriefcaseBusiness className="mr-1.5 size-3" />
          投递看板
        </Button>
      </div>
    </div>
  )
}
