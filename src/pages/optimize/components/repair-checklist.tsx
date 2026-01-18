import { Check, ClipboardCheck, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import useAtsStore from '../store'

export function RepairChecklist() {
  const { currentAtsConfig, loading, revertFixChecklist } = useAtsStore()

  const fixList = currentAtsConfig?.fixChecklist || []

  return (
    <Card className="border-blue-100 dark:border-blue-900 shadow-md overflow-hidden bg-white dark:bg-card p-0 gap-0 rounded-2xl relative">
      <div className="bg-blue-50/50 dark:bg-blue-900/20 pt-6 pb-10 relative">
        <div className="px-6 space-y-1 relative">
          <CardTitle className="text-lg flex items-center gap-2.5 text-blue-700 dark:text-blue-400 font-bold">
            <Wand2 className="w-5 h-5" />
            优化修复清单
          </CardTitle>
          <CardDescription className="text-blue-600/80 dark:text-blue-300/80 text-sm font-medium">
            完成以下强制性优化建议以提升评分
          </CardDescription>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
          <svg
            viewBox="0 0 1440 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-white dark:text-card"
            preserveAspectRatio="none"
          >
            <path
              d="M0 48H1440V0C1440 0 1140 48 720 48C300 48 0 0 0 0V48Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      <CardContent className="p-0 pt-2">
        <ScrollArea className="h-[500px] w-full">
          {loading
            ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground space-y-4">
                  <Spinner className="w-4 h-4 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-600/80">加载修复清单中...</p>
                </div>
              )
            : fixList.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center h-[400px] px-6 text-center space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full ring-8 ring-green-50/50 dark:ring-green-900/10">
                      <ClipboardCheck className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-2 max-w-xs">
                      <h3 className="text-lg font-semibold text-foreground">暂无待修复项</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        太棒了！您的简历已经非常出色，未检测到明显的格式或内容问题。
                      </p>
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-4 p-6">
                    {fixList.map(item => (
                      <div
                        key={item.id}
                        className="group flex items-start gap-4 p-4 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-900 bg-gray-50/50 dark:bg-muted/30 hover:bg-white dark:hover:bg-muted/50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                        onClick={() => revertFixChecklist(item.id)}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-blue-200 dark:border-blue-800 transition-all duration-200 group-hover:border-blue-400',
                            item.isDone ? 'bg-blue-600 border-blue-600 dark:border-blue-600 text-white' : 'bg-white dark:bg-background',
                          )}
                        >
                          {item.isDone && <Check className="h-4 w-4 stroke-3" />}
                        </div>
                        <div className="space-y-2 flex-1 pt-0.5">
                          <label
                            className={cn(
                              'text-base font-semibold leading-snug cursor-pointer select-none block text-foreground/90 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors',
                              item.isDone && 'line-through text-muted-foreground group-hover:text-muted-foreground',
                            )}
                          >
                            {item.title}
                          </label>
                          {item.option === 'required'
                            ? (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/20 dark:text-red-400">
                                  必修项
                                </span>
                              )
                            : (
                                <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20 dark:bg-gray-400/10 dark:text-gray-400">
                                  选修项
                                </span>
                              )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
