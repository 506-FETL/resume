import { CircleAlert, GitBranch } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useVariantLineage } from '../hooks/use-lineage'
import { VariantLineageTree } from './lineage-tree'

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
      <ResponsiveDialogContent className="min-h-0 overflow-hidden sm:max-w-2xl">
        <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <ResponsiveDialogTitle>血缘树</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>查看当前简历所属的派生关系</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-5">
            {loading && (
              <div className="flex flex-col gap-3" aria-label="正在加载血缘树">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="ml-6 h-24 w-[calc(100%-1.5rem)]" />
                <Skeleton className="ml-12 h-24 w-[calc(100%-3rem)]" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertTitle>血缘关系加载失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && !error && tree && (
              <div className="min-w-[32rem]">
                <VariantLineageTree
                  node={tree}
                  currentResumeId={currentResumeId}
                  onOpen={(id) => {
                    onOpen(id)
                    onOpenChange(false)
                  }}
                />
              </div>
            )}

            {!loading && !error && !tree && (
              <Empty className="min-h-72 border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GitBranch />
                  </EmptyMedia>
                  <EmptyTitle>没有血缘信息</EmptyTitle>
                  <EmptyDescription>当前简历还没有可展示的派生关系。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
