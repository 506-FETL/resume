import type { AdvancedToolKey } from './shared/types'
import { DialogClose } from '@radix-ui/react-dialog'
import { useMemo, useRef } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DialogFooter } from '@/components/ui/dialog'
import { DrawerClose, DrawerFooter } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import useAtsStore from '../../store'
import AtsPreviewTool from './ats-preview'
import BenchmarkTool from './benchmark'
import FormatterTool from './formatter'
import JobDescriptionTool from './job-description'
import {
  formatToolError,
  getToolDefinition,
  TOOL_DEFINITIONS,
} from './shared/config'
import { AdvancedToolsModal } from './shared/modal'
import {
  getAdvancedToolResumeSummary,
  loadResumeToolContext,
} from './shared/resume'
import { ToolCard } from './shared/tool-card'

function AdvancedTools() {
  const { currentAtsConfig, selectedResumeId, selectedResumeType } =
    useAtsStore()

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

  const hasSelectedResume = Boolean(selectedResumeId && selectedResumeType)

  const selectedAtsConfig = useMemo(() => {
    if (!selectedResumeId) {
      return null
    }

    if (currentAtsConfig?.resume_id === selectedResumeId) {
      return currentAtsConfig
    }

    return null
  }, [currentAtsConfig, selectedResumeId])

  const activeToolDefinition = useMemo(
    () => getToolDefinition(activeTool),
    [activeTool],
  )

  const resumeSummary = useMemo(
    () =>
      resumeContext ? getAdvancedToolResumeSummary(resumeContext.resume) : null,
    [resumeContext],
  )

  const canReuseResumeContext = useMemo(() => {
    if (!resumeContext || !selectedResumeId || !selectedResumeType) {
      return false
    }

    return (
      resumeContext.resumeId === selectedResumeId &&
      resumeContext.resumeType === selectedResumeType &&
      (resumeContext.atsConfig?.id ?? null) === (selectedAtsConfig?.id ?? null)
    )
  }, [resumeContext, selectedAtsConfig, selectedResumeId, selectedResumeType])

  async function loadContext() {
    if (!selectedResumeId || !selectedResumeType) {
      throw new Error('请先在上方选择要处理的简历')
    }

    return await loadResumeToolContext({
      atsConfig: selectedAtsConfig,
      resumeId: selectedResumeId,
      resumeType: selectedResumeType,
    })
  }

  async function handleOpenTool(tool: AdvancedToolKey) {
    if (!hasSelectedResume) {
      toast.error('请先在上方选择要分析的简历')

      return
    }

    setActiveTool(tool)
    setOpen(true)

    if (canReuseResumeContext) {
      setLoadingContext(false)

      return
    }

    const requestId = ++requestIdRef.current

    setLoadingContext(true)

    try {
      const nextContext = await loadContext()

      if (requestId !== requestIdRef.current) {
        return
      }

      setResumeContext(nextContext)
    } catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(formatToolError(error))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingContext(false)
      }
    }
  }

  async function handleRefreshContext() {
    if (!open || !activeTool) {
      return
    }

    const requestId = ++requestIdRef.current

    setLoadingContext(true)

    try {
      const nextContext = await loadContext()

      if (requestId !== requestIdRef.current) {
        return
      }

      setResumeContext(nextContext)
    } catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(formatToolError(error))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingContext(false)
      }
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      requestIdRef.current += 1
      setLoadingContext(false)
    }
  }

  function renderToolContent() {
    if (loadingContext) {
      return (
        <div className='flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground'>
          <Spinner className='size-6 motion-reduce:animate-none' />
          <p className='text-sm'>正在准备工具结果...</p>
        </div>
      )
    }

    if (!resumeContext || !activeTool) {
      return (
        <div className='flex min-h-48 flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground'>
          <p className='text-sm'>请先选择简历，再打开工具箱。</p>
        </div>
      )
    }

    if (activeTool === 'job-description') {
      return (
        <JobDescriptionTool
          key={`${resumeContext.resumeId}-${resumeContext.resumeType}`}
          resumeContext={resumeContext}
        />
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

      <AdvancedToolsModal
        description={activeToolDefinition?.description}
        footer={
          isMobile ? (
            <DrawerFooter className='shrink-0 border-t bg-muted/30 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:flex md:flex-row md:justify-end md:gap-2'>
              <DrawerClose render={<Button variant='outline' />}>
                取消
              </DrawerClose>
              <Button
                onClick={handleRefreshContext}
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
                onClick={handleRefreshContext}
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
          resumeSummary ? (
            <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              <span className='max-w-64 truncate font-medium text-foreground'>
                {resumeSummary.title}
              </span>
              <span>{resumeSummary.jobIntent}</span>
              <span>
                {resumeSummary.evidenceCount}
                {' 条经历'}
              </span>
              <span>
                {resumeContext?.resumeType === 'offline'
                  ? '本地简历'
                  : '云端简历'}
              </span>
            </div>
          ) : undefined
        }
        title={activeToolDefinition?.title || '高级工具箱'}
      >
        <AnimatedContent
          animationKey={
            loadingContext
              ? 'loading'
              : resumeContext && activeTool
                ? activeTool
                : 'empty'
          }
        >
          {renderToolContent()}
        </AnimatedContent>
      </AdvancedToolsModal>
    </>
  )
}

export default AdvancedTools
