import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useCanvasPreview } from '../../../hooks/use-canvas-preview'

export default function ResumePreview() {
  const { snapshot, status, currentName } = useCanvasPreview()
  const previewData = useMemo(() => (snapshot ? buildTemplateResumeData(snapshot) : null), [snapshot])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{currentName ?? '当前简历'}</span>
      </div>
      {/* 用原生溢出容器而非 Radix ScrollArea：后者视口用 display:table，会让内容按自然宽度撑开导致预览无法按容器宽度自适应缩放 */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-3">
          {status === 'loading' && <Skeleton className="h-[560px] w-full rounded-lg" />}
          {status === 'error' && <p className="py-10 text-center text-sm text-muted-foreground">该简历加载失败，请重试或切换其它简历。</p>}
          {(status === 'empty' || (!previewData && status === 'idle')) && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileText /></EmptyMedia>
                <EmptyTitle>还没有可预览的简历</EmptyTitle>
                <EmptyDescription>在编辑器打开一份简历，或让 AI 新建，这里会实时预览。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {previewData && status === 'idle' && <ScaledReadonlyPreview data={previewData} appearance={snapshot} />}
        </div>
      </div>
    </div>
  )
}
