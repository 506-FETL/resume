import type { ResumeSpotlight } from './use-resume-spotlights'
import { ArrowRight, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import useCurrentResumeStore from '@/store/resume/current'
import { RotatingSlot } from './rotating-slot'

interface CompletenessModuleProps {
  items: ResumeSpotlight[]
  activeIndex: number
  loading: boolean
  onSelectIndex: (index: number) => void
}

export default function CompletenessModule({
  items,
  activeIndex,
  loading,
  onSelectIndex: _onSelectIndex,
}: CompletenessModuleProps) {
  const navigate = useNavigate()
  const { setCurrentResume } = useCurrentResumeStore()
  const activeItem = items[activeIndex] ?? null

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2.5 flex items-center gap-2">
        <FileText className="size-3.5 text-amber-500" />
        <h4 className="text-xs font-medium">内容完善</h4>
      </div>
      <div className="flex flex-1 flex-col rounded-lg border border-amber-100/80 bg-amber-50/80 p-3 dark:border-amber-900/20 dark:bg-amber-950/20">
        <div className="min-h-18 flex-1">
          <RotatingSlot
            activeKey={loading ? 'loading' : activeItem?.resume.resume_id ?? 'empty'}
            className="min-h-18"
            contentClassName="gap-2"
          >
            {loading
              ? (
                  <>
                    <p className="text-[10px] text-amber-700/75 dark:text-amber-400/80">正在切换简历状态...</p>
                    <p className="text-xs text-amber-700/90 dark:text-amber-400/90">正在加载 ATS 建议</p>
                  </>
                )
              : activeItem
                ? (
                    <>
                      <p className="truncate text-[10px] font-medium text-amber-700/75 dark:text-amber-400/80">
                        {activeItem.resume.display_name || '未命名简历'}
                      </p>
                      <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
                        还差
                        {' '}
                        <span className="font-semibold">{activeItem.ats.todoCount}</span>
                        {' '}
                        项优化
                      </p>
                      <div className="relative flex max-h-5.5 flex-wrap gap-1.5 overflow-hidden">
                        {activeItem.ats.todoItems.length > 0
                          ? activeItem.ats.todoItems.map(item => (
                              <span
                                key={item}
                                className="whitespace-nowrap rounded bg-amber-100/60 px-1.5 py-0.5 text-[10px] text-amber-700/80 dark:bg-amber-900/30 dark:text-amber-400/80"
                              >
                                {item}
                              </span>
                            ))
                          : (
                              <span className="text-[10px] text-muted-foreground">
                                {activeItem.ats.hasReport ? '当前没有待优化项' : '先运行一次 ATS 检测'}
                              </span>
                            )}
                      </div>
                    </>
                  )
                : (
                    <>
                      <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
                        还没有云端 ATS 结果
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        完成 ATS 分析后，这里会按简历轮播展示待优化项。
                      </p>
                    </>
                  )}
          </RotatingSlot>
        </div>
        {activeItem && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2.5 h-7 justify-start p-0 text-xs text-amber-600 hover:bg-transparent hover:text-amber-700 dark:text-amber-400"
            onClick={() => {
              setCurrentResume(activeItem.resume.resume_id, activeItem.resume.type)
              navigate('/optimize')
            }}
          >
            去完善
            <ArrowRight className="ml-1 size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
