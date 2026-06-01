import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { deleteOfflineDraftVariant, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { deleteDraftVariant } from '@/lib/supabase/resume/variant'
import useResumeListStore from '@/pages/resume/store'

export interface DerivedJobsDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

export function DerivedJobsDialog({ open, onOpenChange }: DerivedJobsDialogProps) {
  const { resumes, openDeriveFor, loadResumes } = useResumeListStore()

  const generating = useMemo(
    () => resumes.filter(r => r.derived_status === 'generating'),
    [resumes],
  )
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
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>派生任务</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看正在生成或失败的派生草稿</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              生成中
              <Badge variant="secondary">{generating.length}</Badge>
            </h3>
            {generating.length === 0
              ? <p className="text-xs text-muted-foreground">暂无</p>
              : (
                  <ul className="space-y-1">
                    {generating.map(item => (
                      <li key={item.resume_id} className="flex items-center justify-between rounded border p-2">
                        <div className="truncate">{item.display_name || '未命名草稿'}</div>
                        <Button size="sm" variant="ghost" onClick={() => { discard(item.resume_id) }}>
                          丢弃
                        </Button>
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
                      <li key={item.resume_id} className="rounded border p-2 space-y-1">
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
