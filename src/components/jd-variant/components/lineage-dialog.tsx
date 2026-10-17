import { CircleAlert, GitBranch } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
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

export function VariantLineageTreeDialog({ open, onOpenChange, rootResumeId, currentResumeId, onOpen }: VariantLineageTreeDialogProps) {
  // 仅在弹窗打开时才拉取血缘：弹窗常驻挂载，若无条件按 rootId 查询，
  // 协作者一进编辑器就会用自己的 user_id 查所有者的 resume_config，触发 406 噪音。
  const { tree, loading, error } = useVariantLineage(open ? rootResumeId : null)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>

        <ResponsiveDialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <ResponsiveDialogTitle>派生关系</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">原始简历与派生版本</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-6 py-5 overflow-auto">
          {loading && (
            <div className="flex flex-col gap-3" aria-label="正在加载派生关系">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="ml-6 h-24 w-[calc(100%-1.5rem)]" />
              <Skeleton className="ml-12 h-24 w-[calc(100%-3rem)]" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertTitle>派生关系加载失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && tree && (
            <div className="min-w-md pr-2">
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
                <EmptyTitle>暂无派生关系</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>

      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
