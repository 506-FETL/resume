import { FileText } from 'lucide-react'
import { createDeferredComponent } from '@/components/deferred-content'
import AnimatedContent from '@/components/motion/animated-content'
import { AssistantCanvasPreviewSkeleton } from '@/components/page-skeletons/assistant'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { useCanvasPreview } from '../../../hooks/use-canvas-preview'
import useAssistantStore from '../../../store'
import { PreviewHeader } from './preview-header'

const LoadedPreview = createDeferredComponent(
  () => import('./loaded-preview'),
  '简历预览',
  <>
    <PreviewHeader />
    <div className='p-3'>
      <AssistantCanvasPreviewSkeleton />
    </div>
  </>,
  { wrapFallback: false },
)

export default function ResumePreview() {
  const { status, resume, refreshFailed } = useCanvasPreview()

  return (
    <div className='relative h-full min-h-0'>
      <AnimatedContent
        animationKey={status}
        mode='popLayout'
        className='flex h-full min-h-0 flex-col'
      >
        {status === 'idle' && resume ? (
          <>
            {refreshFailed && (
              <div
                role='alert'
                className='flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1 text-sm'
              >
                未能刷新简历，已保留上次预览。
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() =>
                    useAssistantStore.getState().bumpCanvasRefresh()
                  }
                >
                  重试
                </Button>
              </div>
            )}
            <div className='min-h-0 flex-1'>
              <LoadedPreview {...resume} />
            </div>
          </>
        ) : (
          <div
            data-feature-guide-preview-status={status}
            className='flex h-full min-h-0 flex-col'
          >
            <PreviewHeader name={resume?.name} />
            <div className='min-h-0 flex-1 overflow-y-auto p-3'>
              {status === 'loading' && <AssistantCanvasPreviewSkeleton />}
              {status === 'error' && (
                <div className='space-y-3 py-10 text-center'>
                  <p className='text-sm text-muted-foreground'>
                    简历加载失败，请重试。
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      useAssistantStore.getState().bumpCanvasRefresh()
                    }
                  >
                    重新加载
                  </Button>
                </div>
              )}
              {status === 'empty' && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant='icon'>
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>还没有可预览的简历</EmptyTitle>
                    <EmptyDescription>
                      先在编辑器打开简历，或让 AI 新建。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        )}
      </AnimatedContent>
    </div>
  )
}
