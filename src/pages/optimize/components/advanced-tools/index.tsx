import type { AdvancedToolKey } from './shared/types'
import { DialogClose } from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContentSkeleton } from '@/components/loading-skeleton'
import { DialogFooter } from '@/components/ui/dialog'
import { DrawerClose, DrawerFooter } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import useAtsStore from '../../store'
import {
  formatToolError,
  getToolDefinition,
  TOOL_DEFINITIONS,
} from './shared/config'
import { AdvancedToolsModal } from './shared/modal'
import { useJobContextStore } from '@/lib/job-context-store'
import {
  AtsPreviewTool,
  BenchmarkTool,
  FormatterTool,
  JobDescriptionTool,
  ToolMeta,
} from './tool-modules'
import { ToolCard } from './shared/tool-card'

const toolContents = {
  'ats-preview': AtsPreviewTool,
  benchmark: BenchmarkTool,
  formatter: FormatterTool,
  'job-description': JobDescriptionTool,
}

function AdvancedTools() {
  const currentAtsConfig = useAtsStore((s) => s.currentAtsConfig)
  const selectedResumeId = useAtsStore((s) => s.selectedResumeId)
  const selectedResumeType = useAtsStore((s) => s.selectedResumeType)

  const isMobile = useIsMobile()

  const activeTool = useAtsStore((s) => s.advancedToolActiveTool)
  const open = useAtsStore((s) => s.advancedToolOpen)
  const loadingContext = useAtsStore((s) => s.advancedToolLoadingContext)
  const resumeContext = useAtsStore((s) => s.advancedToolResumeContext)
  const setActiveTool = useAtsStore((s) => s.setAdvancedToolActiveTool)
  const setOpen = useAtsStore((s) => s.setAdvancedToolOpen)
  const setLoadingContext = useAtsStore((s) => s.setAdvancedToolLoadingContext)
  const setResumeContext = useAtsStore((s) => s.setAdvancedToolResumeContext)
  const requestIdRef = useRef(0)
  const contextSource = useAtsStore((state) => state.advancedToolContextSource)

  const sourceUpdatedAt = useAtsStore((state) =>
    state.selectedResumeOption?.resume_id === selectedResumeId
      ? (state.selectedResumeOption?.updated_at ?? '')
      : '',
  )

  const hasSelectedResume = Boolean(selectedResumeId && selectedResumeType)

  const selectedAtsConfig =
    currentAtsConfig?.resume_id === selectedResumeId ? currentAtsConfig : null

  const activeToolDefinition = getToolDefinition(activeTool)

  const matchesResume =
    resumeContext?.resumeId === selectedResumeId &&
    resumeContext?.resumeType === selectedResumeType

  const canReuseResumeContext =
    matchesResume &&
    Boolean(sourceUpdatedAt) &&
    contextSource === sourceUpdatedAt &&
    resumeContext?.atsConfig === selectedAtsConfig

  const [error, setError] = useState<string | null>(null)
  const [initialJd, setInitialJd] = useState<Promise<string>>()

  async function loadContext(force = false) {
    const requestId = ++requestIdRef.current

    setError(null)
    setLoadingContext(true)

    try {
      await useAtsStore
        .getState()
        .loadAdvancedToolContext(sourceUpdatedAt, force)
    } catch (error) {
      if (requestId === requestIdRef.current) setError(formatToolError(error))
    } finally {
      if (requestId === requestIdRef.current) setLoadingContext(false)
    }
  }

  function handleOpenTool(tool: AdvancedToolKey) {
    if (!hasSelectedResume) {
      toast.error('请先在上方选择要分析的简历')

      return
    }

    toolContents[tool].preload().catch(() => {})
    ToolMeta.preload().catch(() => {})

    const job = useJobContextStore.getState().context

    if (
      tool === 'job-description' &&
      job &&
      job.id === new URLSearchParams(window.location.search).get('jobId') &&
      job.resumeId === selectedResumeId &&
      job.jdText === undefined
    ) {
      const description = import('@/lib/job-context').then(
        ({ readJobContextDescription }) => readJobContextDescription(job),
      )

      description.catch(() => {})
      setInitialJd(description)
    } else {
      setInitialJd(undefined)
    }

    setActiveTool(tool)
    setOpen(true)
    setError(null)

    if (!canReuseResumeContext) loadContext()
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      requestIdRef.current += 1
      setLoadingContext(false)
    }
  }

  function renderToolContent() {
    if (
      activeTool === 'job-description' &&
      selectedResumeId &&
      selectedResumeType
    ) {
      const ready =
        matchesResume && (canReuseResumeContext || (!loadingContext && !error))

      return (
        <JobDescriptionTool
          key={`${selectedResumeType}-${selectedResumeId}`}
          initialJobDescription={initialJd}
          resumeId={selectedResumeId}
          resumeType={selectedResumeType}
          resume={ready ? resumeContext?.resume : undefined}
        />
      )
    }

    if (loadingContext && !canReuseResumeContext) {
      return (
        <ContentSkeleton
          label='正在读取简历与工具结果'
          className='min-h-48 px-0'
          rows={3}
        />
      )
    }

    if (error && !canReuseResumeContext) return null

    if (!resumeContext || !matchesResume || !activeTool) {
      return (
        <div className='flex min-h-48 flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground'>
          <p className='text-sm'>请先选择简历，再打开工具箱。</p>
        </div>
      )
    }

    if (activeTool === 'formatter') {
      return (
        <FormatterTool
          key={`${resumeContext.resumeId}-${resumeContext.resumeType}`}
          resumeContext={resumeContext}
          onResumeUpdated={setResumeContext}
        />
      )
    }

    if (activeTool === 'ats-preview') {
      return (
        <AtsPreviewTool
          key={`${resumeContext.resumeId}-${resumeContext.resumeType}`}
          resumeContext={resumeContext}
        />
      )
    }

    return (
      <BenchmarkTool
        key={`${resumeContext.resumeId}-${resumeContext.resumeType}`}
        resumeContext={resumeContext}
      />
    )
  }

  return (
    <>
      <section className='min-w-0 border-t pt-6'>
        <header className='pb-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <h2 className='text-lg font-semibold tracking-tight'>简历工具</h2>
            </div>

            <div className='flex shrink-0 flex-wrap items-center gap-2'>
              <Badge
                className={
                  hasSelectedResume
                    ? 'rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }
              >
                {hasSelectedResume ? '已选择简历' : '请先选择简历'}
              </Badge>
            </div>
          </div>
        </header>

        <div className='grid min-w-0 grid-cols-1 gap-x-8 sm:grid-cols-2'>
          {TOOL_DEFINITIONS.map((tool) => (
            <ToolCard
              key={tool.key}
              disabled={!hasSelectedResume}
              onClick={() => handleOpenTool(tool.key)}
              tool={tool}
            />
          ))}
        </div>
      </section>

      {activeTool && (
        <AdvancedToolsModal
          description={activeToolDefinition?.description}
          footer={
            isMobile ? (
              <DrawerFooter className='shrink-0 border-t bg-muted/30 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:flex md:flex-row md:justify-end md:gap-2'>
                <DrawerClose render={<Button variant='outline' />}>
                  取消
                </DrawerClose>
                <Button
                  onClick={() => loadContext(true)}
                  disabled={!activeTool || loadingContext}
                >
                  刷新数据
                </Button>
              </DrawerFooter>
            ) : (
              <DialogFooter className='px-4 py-3 shrink-0 border-t bg-muted/30'>
                <DialogClose asChild>
                  <Button variant='outline'>取消</Button>
                </DialogClose>
                <Button
                  onClick={() => loadContext(true)}
                  disabled={!activeTool || loadingContext}
                >
                  刷新数据
                </Button>
              </DialogFooter>
            )
          }
          onOpenChange={handleOpenChange}
          open={open}
          meta={
            matchesResume && resumeContext ? (
              <ToolMeta context={resumeContext} />
            ) : loadingContext ? (
              <Skeleton className='h-4 w-48' aria-label='正在读取简历信息' />
            ) : undefined
          }
          title={activeToolDefinition?.title || '高级工具箱'}
        >
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <AnimatedContent
            animationKey={
              activeTool === 'job-description'
                ? activeTool
                : loadingContext && !canReuseResumeContext
                  ? 'loading'
                  : resumeContext && activeTool
                    ? activeTool
                    : 'empty'
            }
          >
            {renderToolContent()}
          </AnimatedContent>
        </AdvancedToolsModal>
      )}
    </>
  )
}

export default AdvancedTools
