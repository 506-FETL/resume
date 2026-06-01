import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useVariantLineage } from './use-variant-lineage'
import { VariantLineageTree } from './variant-lineage-tree'

export interface VariantLineageTreeDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  rootResumeId: string | null
  currentResumeId: string
  onOpen: (resumeId: string) => void
}

export function VariantLineageTreeDialog({
  open,
  onOpenChange,
  rootResumeId,
  currentResumeId,
  onOpen,
}: VariantLineageTreeDialogProps) {
  const { tree, loading, error } = useVariantLineage(rootResumeId)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <ResponsiveDialogTitle>血缘树</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看当前简历所属的派生关系</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ScrollArea className="max-h-[60vh] px-6 py-5">
          {loading && <p className="text-sm text-muted-foreground">加载中...</p>}
          {error && (
            <p className="text-sm text-destructive">
              加载失败：
              {error}
            </p>
          )}
          {!loading && !error && tree && (
            <VariantLineageTree
              node={tree}
              currentResumeId={currentResumeId}
              onOpen={(id) => {
                onOpen(id)
                onOpenChange(false)
              }}
            />
          )}
          {!loading && !error && !tree && (
            <p className="text-sm text-muted-foreground">没有血缘信息</p>
          )}
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
