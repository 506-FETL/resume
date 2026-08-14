import { Check, ClipboardCheck, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import useAtsStore from '../../store'

export default function RepairChecklist() {
  const { currentAtsConfig, loading, revertFixChecklist } = useAtsStore()

  const fixList = currentAtsConfig?.fixChecklist || []

  return (
    <Card className="flex min-w-0 flex-col border-primary/10 shadow-sm">
      <CardHeader className="border-b border-border/50 p-4 md:p-5">
        <div className="mb-1 flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <Wand2 className="size-4" />
          </div>
          <CardTitle className="text-base font-semibold md:text-lg">优化修复清单</CardTitle>
        </div>
        <CardDescription className="text-xs leading-5 md:text-sm">
          仅展示基于当前真实内容发现的可执行问题
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 p-0">
        {loading
          ? (
              <div className="flex items-center justify-center gap-3 px-5 py-8 text-muted-foreground">
                <Spinner className="size-5 animate-spin text-primary" />
                <p className="text-sm font-medium">分析修复项中...</p>
              </div>
            )
          : fixList.length === 0
            ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-8 text-center">
                  <div className="rounded-full bg-green-100/50 p-3 dark:bg-green-900/20">
                    <ClipboardCheck className="size-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="max-w-xs space-y-1">
                    <h3 className="text-sm font-semibold">当前未发现必须修改项</h3>
                    <p className="text-xs leading-5 text-muted-foreground">
                      本次评分已综合现有内容，不会因为未使用某个模板模块而生成任务。
                    </p>
                  </div>
                </div>
              )
            : (
                <div className="space-y-1 p-3 md:p-4">
                  {fixList.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'group flex w-full items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-all duration-200',
                        'hover:border-border/50 hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                        item.isDone ? 'opacity-60' : 'bg-card',
                      )}
                      onClick={() => revertFixChecklist(item.id)}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200',
                          item.isDone
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30 bg-background group-hover:border-primary/50',
                        )}
                      >
                        {item.isDone && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span
                          className={cn(
                            'block wrap-break-word text-sm font-medium leading-snug transition-colors',
                            item.isDone ? 'text-muted-foreground line-through' : 'text-foreground group-hover:text-primary',
                          )}
                        >
                          {item.title}
                        </span>
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
                      </span>
                    </button>
                  ))}
                </div>
              )}
      </CardContent>
    </Card>
  )
}
