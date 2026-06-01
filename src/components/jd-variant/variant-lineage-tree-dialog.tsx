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
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>血缘树</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看当前简历所属的派生关系</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          {loading && <p className="text-xs text-muted-foreground">加载中...</p>}
          {error && (
            <p className="text-xs text-destructive">
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
            <p className="text-xs text-muted-foreground">没有血缘信息</p>
          )}
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
