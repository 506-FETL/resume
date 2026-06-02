import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
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
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <ResponsiveDialogTitle>派生任务</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看正在生成或失败的派生草稿</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              生成中
              <Badge variant="secondary">{runningItems.length}</Badge>
            </h3>
            {runningItems.length === 0
              ? <p className="text-xs text-muted-foreground">暂无</p>
              : (
                  <ul className="space-y-2">
                    {runningItems.map(item => (
                      <li key={item.parentResumeId} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                        <div className="truncate">{item.parentName}</div>
                        <div className="flex gap-1">
                          {item.source === 'store' && (
                            <Button
                              size="sm"
                              variant="ghost"
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
                            variant="ghost"
                            onClick={() => discardRunning(item)}
                          >
                            丢弃
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
          </section>
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              失败
              <Badge variant="destructive">{failed.length}</Badge>
            </h3>
            {failed.length === 0
              ? <p className="text-xs text-muted-foreground">暂无</p>
              : (
                  <ul className="space-y-2">
                    {failed.map(item => (
                      <li key={item.resume_id} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">{item.display_name || '未命名草稿'}</div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => retry(item.resume_id, item.parent_resume_id)}
                              disabled={!item.parent_resume_id}
                            >
                              重试
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { discard(item.resume_id) }}>
                              丢弃
                            </Button>
                          </div>
                        </div>
                        {item.linked_jd_text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            JD：
                            {item.linked_jd_text.slice(0, 80)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
          </section>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
