import type { TemplateRecord } from '@/lib/resume-template/schema'
import { ArrowRight, Eye, FolderCode, LoaderCircle, SquarePen, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/utils/date'
import { TEMPLATE_CENTER_TAB_META } from '../../const'
import { useTemplateWorkbenchStore, useUserTemplatesStore } from '../../store'
import { TemplateCard } from './template-card'
import { TemplateThumbnail } from './template-thumbnail'

function formatSkeletonLabel(skeleton: string) {
  switch (skeleton) {
    case 'single-column':
      return '单栏'
    case 'sidebar-left':
      return '左侧栏'
    case 'sidebar-right':
      return '右侧栏'
    case 'stacked':
      return '分段式'
    default:
      return skeleton
  }
}

function DeleteTemplateButton({
  template,
}: {
  template: TemplateRecord
}) {
  const { deleteUserTemplateRecord } = useTemplateWorkbenchStore()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteUserTemplateRecord(template.id)
      setOpen(false)
    }
    finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="删除模板"
        className="shrink-0"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <Trash2 />
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!deleting) {
            setOpen(nextOpen)
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>删除这个模板？</AlertDialogTitle>
            <AlertDialogDescription>
              {template.meta.name}
              删除后会从“我的模板”中移除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={handleConfirmDelete}>
              {deleting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function UserTemplateSection() {
  const { userTemplates: templates } = useUserTemplatesStore()
  const { createResumeWithTemplate, openUserTemplateEditor, setTab } = useTemplateWorkbenchStore()
  const sectionMeta = TEMPLATE_CENTER_TAB_META.mine

  const sectionHeader = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{templates.length > 0 ? `${templates.length} 个模板` : '等待创建'}</Badge>
        {templates.length > 0 ? <Badge variant="outline">仅自己可见</Badge> : null}
      </div>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{sectionMeta.description}</p>
    </div>
  )

  if (templates.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {sectionHeader}

        <Separator />

        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderCode />
            </EmptyMedia>
            <EmptyTitle>还没有我的模板</EmptyTitle>
            <EmptyContent className="flex-row justify-center">
              <Button onClick={() => setTab('official')}>
                <Eye />
                查看官方模板
              </Button>
            </EmptyContent>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {sectionHeader}

      <Separator />

      <div className="grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.82,
                y: -20,
                transition: { duration: 0.2 },
              }}
              transition={{
                duration: 0.28,
                delay: index * 0.04,
                layout: { duration: 0.28 },
              }}
            >
              <TemplateCard
                preview={<TemplateThumbnail manifest={template.manifest} />}
                title={template.meta.name}
                description={template.meta.description ?? '未填写模板说明'}
                trailing={<DeleteTemplateButton template={template} />}
                meta={(
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        最近更新：
                        {formatRelativeTime(template.meta.updatedAt)}
                      </span>
                    </div>
                  </div>
                )}
                hoverActions={[
                  {
                    label: '直接使用',
                    icon: ArrowRight,
                    onClick: async () => createResumeWithTemplate('user', template.id),
                  },
                  {
                    label: '继续编辑',
                    icon: SquarePen,
                    onClick: () => openUserTemplateEditor(template.id),
                    variant: 'secondary',
                  },
                ]}
                tags={(
                  <>
                    <Badge variant="secondary">私有</Badge>
                    <Badge variant="outline">{formatSkeletonLabel(template.manifest.layout.skeleton)}</Badge>
                  </>
                )}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
