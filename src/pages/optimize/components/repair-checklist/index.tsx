import { Check, ClipboardCheck, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'

export default function RepairChecklist() {
  const { currentAtsConfig, loading, revertFixChecklist } = useAtsStore()

  const fixList = currentAtsConfig?.fixChecklist || []

  return (
    <Card className="border-primary/10 shadow-sm flex flex-col h-full">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Wand2 className="size-4" />
          </div>
          <CardTitle className="text-lg font-bold">优化修复清单</CardTitle>
        </div>
        <CardDescription className="text-sm">
          仅展示基于当前真实内容发现的可执行问题
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-100 w-full">
          {loading
            ? (
                <div className="flex flex-col items-center justify-center h-75 text-muted-foreground gap-3">
                  <Spinner className="size-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">分析修复项中...</p>
                </div>
              )
            : fixList.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center h-75 px-6 text-center gap-4">
                    <div className="bg-green-100/50 dark:bg-green-900/20 p-4 rounded-full">
                      <ClipboardCheck className="size-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h3 className="text-base font-semibold">当前未发现必须修改项</h3>
                      <p className="text-sm text-muted-foreground">
                        本次评分已综合现有内容，不会因为未使用某个模板模块而生成任务。
                      </p>
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-1 p-4">
                    {fixList.map(item => (
                      <div
                        key={item.id}
                        className={cn(
                          'group flex items-start gap-3 p-3 rounded-lg border border-transparent transition-all duration-200 cursor-pointer',
                          'hover:bg-muted/50 hover:border-border/50',
                          item.isDone ? 'opacity-60' : 'bg-card',
                        )}
                        onClick={() => revertFixChecklist(item.id)}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200',
                            item.isDone
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30 group-hover:border-primary/50 bg-background',
                          )}
                        >
                          {item.isDone && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <label
                            className={cn(
                              'text-sm font-medium leading-snug cursor-pointer block transition-colors',
                              item.isDone ? 'line-through text-muted-foreground' : 'text-foreground group-hover:text-primary',
                            )}
                          >
                            {item.title}
                          </label>
                          {item.option === 'required'
                            ? (
                                <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                                  必修
                                </span>
                              )
                            : (
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground ring-1 ring-inset ring-secondary-foreground/10">
                                  可选
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
