import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTemplateEditorStore, useTemplateWorkbenchStore } from '../../store'

export function TemplateEditorToolbar() {
  const { manifestDraft, dirty, saving, templateId } = useTemplateEditorStore()
  const { openLibrary, resetActiveTemplateDraft, saveActiveTemplate, saveActiveTemplateAsCopy } = useTemplateWorkbenchStore()
  const [backDialogOpen, setBackDialogOpen] = useState(false)

  if (!manifestDraft) {
    return null
  }

  const canSaveAs = Boolean(templateId)
  const handleBack = () => {
    if (dirty) {
      setBackDialogOpen(true)
      return
    }

    openLibrary()
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">模板编辑器</p>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{manifestDraft.meta.name}</h1>
              {dirty ? <Badge variant="secondary">未保存</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleBack}>
              返回列表
            </Button>
            <Button variant="outline" onClick={resetActiveTemplateDraft}>
              恢复默认
            </Button>
            {canSaveAs
              ? (
                  <Button variant="outline" onClick={saveActiveTemplateAsCopy}>
                    另存为副本
                  </Button>
                )
              : null}
            <Button onClick={saveActiveTemplate} disabled={saving}>
              {saving ? '保存中...' : canSaveAs ? '保存当前' : '保存到我的模板'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {canSaveAs
            ? '保存会覆盖当前模板；另存为会保留当前模板，并创建一份新的个人模板副本。'
            : '当前模板还未保存。点击保存后会把它创建到“我的模板”里。'}
        </p>
      </div>

      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>离开编辑器？</AlertDialogTitle>
            <AlertDialogDescription>
              当前模板还有未保存的修改，确定要离开吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => openLibrary()}>确定离开</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
