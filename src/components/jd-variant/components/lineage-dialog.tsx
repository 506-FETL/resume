import { CircleAlert, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
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
  // 关闭时停止发起读取，但保留现有内容直到弹层退出完成。
  const { tree, loading, error, refresh } = useVariantLineage(
    rootResumeId,
    open,
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='h-[min(80dvh,40rem)] sm:max-w-2xl'
    >
      <ResponsiveDialogContent className='min-h-0 overflow-hidden'>
        <ResponsiveDialogHeader className='shrink-0 border-b px-5 py-5 text-left sm:px-6'>
          <ResponsiveDialogTitle>派生关系</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            原始简历与派生版本
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ScrollArea className='min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-viewport]]:overscroll-contain'>
          <div className='px-5 py-5 sm:px-6'>
            {loading && (
              <div
                className='flex flex-col gap-3'
                aria-label='正在加载派生关系'
              >
                <Skeleton className='h-24 w-full' />
                <Skeleton className='ml-6 h-24 w-[calc(100%-1.5rem)]' />
                <Skeleton className='ml-12 h-24 w-[calc(100%-3rem)]' />
              </div>
            )}

            {error && (
              <Alert variant='destructive'>
                <CircleAlert aria-hidden />
                <AlertTitle>派生关系加载失败</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => refresh()}
                  >
                    重新加载
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!loading && !error && tree && (
              <div className='min-w-0'>
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
              <Empty className='min-h-56'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <GitBranch />
                  </EmptyMedia>
                  <EmptyTitle>暂无派生关系</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
