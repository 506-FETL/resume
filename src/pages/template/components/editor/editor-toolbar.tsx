import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import { useTemplateEditorStore, useTemplateWorkbenchStore } from '../../store'

export function TemplateEditorToolbar() {
  const reduceMotion = useReducedMotion()
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
              <AnimatePresence initial={false}>
                {dirty && (
                  <motion.span
                    key="dirty"
                    initial={{ opacity: reduceMotion ? 1 : 0, width: reduceMotion ? 'auto' : 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
                    transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    <Badge variant="secondary">未保存</Badge>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatedContent animationKey={canSaveAs ? 'existing' : 'new'} className="flex flex-wrap items-center gap-2">
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
            <Button onClick={saveActiveTemplate} disabled={saving} aria-busy={saving}>
              <AnimatedContent as="span" animationKey={saving ? 'saving' : 'idle'} className="inline-flex items-center">
                {saving ? '保存中...' : canSaveAs ? '保存当前' : '保存到我的模板'}
              </AnimatedContent>
            </Button>
          </AnimatedContent>
        </div>

        <AnimatedContent animationKey={canSaveAs ? 'existing' : 'new'} className="text-sm text-muted-foreground">
          {canSaveAs
            ? '保存会覆盖当前模板；另存为副本会保留原模板。'
            : '保存后将添加到“我的模板”。'}
        </AnimatedContent>
      </div>

      <AlertDialog open={backDialogOpen} onOpenChange={setBackDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>离开编辑器？</AlertDialogTitle>
            <AlertDialogDescription>
              离开后，未保存的修改将丢失。
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
