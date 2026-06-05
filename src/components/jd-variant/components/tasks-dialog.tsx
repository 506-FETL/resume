import { CircleAlert, GitBranch } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deleteOfflineDraftVariant, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { deleteDraftVariant } from '@/lib/supabase/resume/variant'
import useResumeListStore from '@/pages/resume/store'
import useJdVariantStore from '@/store/jd-variant'

export interface DerivedJobsDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

type RunningItem
  = | { parentResumeId: string, parentName: string, source: 'store' }
    | { parentResumeId: string, parentName: string, source: 'db', dbResumeId: string }

export function DerivedJobsDialog({ open, onOpenChange }: DerivedJobsDialogProps) {
  const { resumes, openDeriveFor, loadResumes } = useResumeListStore()
  const tasks = useJdVariantStore(s => s.tasks)
  const discardTask = useJdVariantStore(s => s.discardTask)

  const runningItems = useMemo<RunningItem[]>(() => {
    const resumeNameById = new Map(resumes.map(r => [r.resume_id, r.display_name]))

    const storeRunning: RunningItem[] = Object.values(tasks)
      .filter(t => t.phase === 'parsing' || t.phase === 'rewriting')
      .map(t => ({
        parentResumeId: t.parentResumeId,
        parentName: resumeNameById.get(t.parentResumeId) ?? '未命名简历',
        source: 'store',
      }))

    const storeParentIds = new Set(storeRunning.map(item => item.parentResumeId))

    const seen = new Set<string>()
    const dbRunning: RunningItem[] = []
    for (const r of resumes) {
      if (r.derived_status !== 'generating')
        continue
      const parentId = r.parent_resume_id ?? r.resume_id
      if (storeParentIds.has(r.parent_resume_id ?? ''))
        continue
      if (seen.has(parentId))
        continue
      seen.add(parentId)
      dbRunning.push({
        parentResumeId: parentId,
        parentName: resumeNameById.get(r.parent_resume_id ?? '') ?? '未命名简历',
        source: 'db',
        dbResumeId: r.resume_id,
      })
    }

    return [...storeRunning, ...dbRunning]
  }, [tasks, resumes])

  const failed = useMemo(
    () => resumes.filter(r => r.derived_status === 'failed'),
    [resumes],
  )

  const discard = async (id: string) => {
    try {
      if (isOfflineResumeId(id))
        await deleteOfflineDraftVariant(id)
      else
        await deleteDraftVariant(id)
    }
    finally {
      await loadResumes()
    }
  }

  const discardRunning = (item: RunningItem) => {
    if (item.source === 'db') {
      discard(item.dbResumeId)
      return
    }
    // store 任务：discardTask 会中止生成并删除草稿，随后刷新列表清除陈旧的 generating 行
    discardTask(item.parentResumeId)
      .catch(() => undefined)
      .finally(() => loadResumes())
  }

  const retry = (id: string, parentId: string | null | undefined) => {
    if (!parentId)
      return
    discard(id).finally(() => {
      openDeriveFor(parentId)
      onOpenChange(false)
    })
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="min-h-0 overflow-hidden sm:max-w-lg">
        <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <ResponsiveDialogTitle>派生任务</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看正在生成或失败的派生草稿</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Tabs defaultValue="running" className="min-h-0 flex-1 gap-4 px-6 py-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="running">
              生成中
              <Badge variant="secondary">{runningItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="failed">
              失败
              <Badge variant="destructive">{failed.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="running" className="min-h-0">
            {runningItems.length === 0
              ? (
                  <Empty className="min-h-72 border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <GitBranch />
                      </EmptyMedia>
                      <EmptyTitle>暂无进行中的派生任务</EmptyTitle>
                      <EmptyDescription>开始派生后，可以在这里重新打开并查看实时进度。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              : (
                  <ScrollArea className="h-[min(55vh,28rem)] pr-3">
                    <ul className="flex flex-col gap-3">
                      {runningItems.map(item => (
                        <li key={item.parentResumeId}>
                          <Card className="gap-4 py-4 shadow-none">
                            <CardHeader className="px-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <CardTitle className="truncate">{item.parentName}</CardTitle>
                                  <CardDescription>
                                    {item.source === 'store' ? '任务正在后台生成' : '检测到未完成的派生草稿'}
                                  </CardDescription>
                                </div>
                                <Badge variant="secondary">生成中</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="px-4">
                              <p className="text-sm text-muted-foreground">
                                {item.source === 'store'
                                  ? '可以关闭当前窗口，生成过程会继续在后台运行。'
                                  : '页面刷新后实时过程不可恢复，但仍可丢弃该草稿。'}
                              </p>
                            </CardContent>
                            <CardFooter className="flex flex-wrap justify-end gap-2 px-4">
                              {item.source === 'store' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    openDeriveFor(item.parentResumeId)
                                    onOpenChange(false)
                                  }}
                                >
                                  查看进度
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => discardRunning(item)}
                              >
                                丢弃
                              </Button>
                            </CardFooter>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
          </TabsContent>

          <TabsContent value="failed" className="min-h-0">
            {failed.length === 0
              ? (
                  <Empty className="min-h-72 border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CircleAlert />
                      </EmptyMedia>
                      <EmptyTitle>暂无失败任务</EmptyTitle>
                      <EmptyDescription>失败的派生草稿会保留在这里，便于重试或清理。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              : (
                  <ScrollArea className="h-[min(55vh,28rem)] pr-3">
                    <ul className="flex flex-col gap-3">
                      {failed.map(item => (
                        <li key={item.resume_id}>
                          <Card className="gap-4 py-4 shadow-none">
                            <CardHeader className="px-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <CardTitle className="truncate">{item.display_name || '未命名草稿'}</CardTitle>
                                  <CardDescription>本次派生未能完成</CardDescription>
                                </div>
                                <Badge variant="destructive">失败</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="px-4">
                              {item.linked_jd_text
                                ? (
                                    <p className="line-clamp-3 text-sm text-muted-foreground">
                                      JD：
                                      {item.linked_jd_text.slice(0, 120)}
                                    </p>
                                  )
                                : <p className="text-sm text-muted-foreground">没有可显示的职位描述摘要。</p>}
                            </CardContent>
                            <CardFooter className="flex flex-wrap justify-end gap-2 px-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retry(item.resume_id, item.parent_resume_id)}
                                disabled={!item.parent_resume_id}
                              >
                                重试
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { discard(item.resume_id) }}>
                                丢弃
                              </Button>
                            </CardFooter>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
