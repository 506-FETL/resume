import type { AdvancedToolKey } from './shared/types'
import { DialogClose } from '@radix-ui/react-dialog'
import { useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogFooter } from '@/components/ui/dialog'
import { DrawerClose, DrawerFooter } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import useAtsStore from '../../store'
import AtsPreviewTool from './ats-preview'
import BenchmarkTool from './benchmark'
import FormatterTool from './formatter'
import JobDescriptionTool from './job-description'
import { formatToolError, getToolDefinition, TOOL_DEFINITIONS } from './shared/config'
import { AdvancedToolsModal } from './shared/modal'
import { getAdvancedToolResumeSummary, loadResumeToolContext } from './shared/resume'
import { ToolCard } from './shared/tool-card'

function AdvancedTools() {
  const { currentAtsConfig, selectedResumeId, selectedResumeType } = useAtsStore()
  const isMobile = useIsMobile()

  const activeTool = useAtsStore(s => s.advancedToolActiveTool)
  const open = useAtsStore(s => s.advancedToolOpen)
  const loadingContext = useAtsStore(s => s.advancedToolLoadingContext)
  const resumeContext = useAtsStore(s => s.advancedToolResumeContext)
  const setActiveTool = useAtsStore(s => s.setAdvancedToolActiveTool)
  const setOpen = useAtsStore(s => s.setAdvancedToolOpen)
  const setLoadingContext = useAtsStore(s => s.setAdvancedToolLoadingContext)
  const setResumeContext = useAtsStore(s => s.setAdvancedToolResumeContext)
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
    () => resumeContext ? getAdvancedToolResumeSummary(resumeContext.resume) : null,
    [resumeContext],
  )

  const canReuseResumeContext = useMemo(() => {
    if (!resumeContext || !selectedResumeId || !selectedResumeType) {
      return false
    }

    return (
      resumeContext.resumeId === selectedResumeId
      && resumeContext.resumeType === selectedResumeType
      && (resumeContext.atsConfig?.id ?? null) === (selectedAtsConfig?.id ?? null)
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
    }
    catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(formatToolError(error))
      }
    }
    finally {
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
    }
    catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(formatToolError(error))
      }
    }
    finally {
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
        <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm">正在准备工具结果...</p>
        </div>
      )
    }

    if (!resumeContext || !activeTool) {
      return (
        <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="text-sm">请先选择简历，再打开工具箱。</p>
        </div>
      )
    }

    if (activeTool === 'job-description') {
      return <JobDescriptionTool key={`${resumeContext.resumeId}-${resumeContext.resumeType}`} resumeContext={resumeContext} />
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
      return <AtsPreviewTool key={`${resumeContext.resumeId}-${resumeContext.resumeType}`} resumeContext={resumeContext} />
    }

    return <BenchmarkTool key={`${resumeContext.resumeId}-${resumeContext.resumeType}`} resumeContext={resumeContext} />
  }

  return (
    <>
      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-primary/10 text-primary">Optimize Suite</Badge>
                <Badge variant="outline" className="rounded-full">4 个工具</Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">高级工具箱</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-7">
                基于当前选中的简历做局部比对、格式修复、ATS 预览和岗位基准分析。工具复用现有 ATS 与在线/离线简历数据流，不再维护平行逻辑。
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={hasSelectedResume
                  ? 'rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
              >
                {hasSelectedResume ? '已连接到当前选中简历' : '请先选择简历'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {TOOL_DEFINITIONS.map(tool => (
              <ToolCard
                key={tool.key}
                disabled={!hasSelectedResume}
                onClick={() => handleOpenTool(tool.key)}
                tool={tool}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <AdvancedToolsModal
        description={(
          <div className="space-y-3">
            <p>{activeToolDefinition?.description}</p>
            {resumeSummary && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{resumeSummary.title}</Badge>
                <Badge variant="outline" className="rounded-full">{resumeSummary.jobIntent}</Badge>
                <Badge variant="outline" className="rounded-full">
                  已填板块
                  {' '}
                  {resumeSummary.sectionCount}
                  /12
                </Badge>
                <Badge
                  className={resumeContext?.resumeType === 'offline'
                    ? 'rounded-full border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'rounded-full border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300'}
                >
                  {resumeContext?.resumeType === 'offline' ? '本地简历' : '在线简历'}
                </Badge>
                {activeToolDefinition && (
                  <Badge className={activeToolDefinition.badgeClassName}>{activeToolDefinition.badge}</Badge>
                )}
              </div>
            )}
          </div>
        )}
        footer={
          isMobile
            ? (
                <DrawerFooter className="px-4 py-3 shrink-0 border-t bg-muted/30 md:flex md:flex-row md:gap-2 md:justify-end">
                  <DrawerClose render={<Button variant="outline" />}>
                    取消
                  </DrawerClose>
                  <Button onClick={handleRefreshContext} disabled={!activeTool || loadingContext}>
                    刷新数据
                  </Button>
                </DrawerFooter>
              )
            : (
                <DialogFooter className="px-4 py-3 shrink-0 border-t bg-muted/30">
                  <DialogClose asChild>
                    <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button onClick={handleRefreshContext} disabled={!activeTool || loadingContext}>
                    刷新数据
                  </Button>
                </DialogFooter>
              )
        }
        onOpenChange={handleOpenChange}
        open={open}
        title={activeToolDefinition?.title || '高级工具箱'}
      >
        {renderToolContent()}
      </AdvancedToolsModal>
    </>
  )
}

export default AdvancedTools
