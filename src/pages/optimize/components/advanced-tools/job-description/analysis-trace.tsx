import type { ToolTone } from '../shared/primitives'
import type { AnalysisState, AnalysisStatus, StepConfig } from '@/pages/optimize/types'
import { Brain } from 'lucide-react'
import Markdown from 'react-markdown'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from '@/components/ai/chain-of-thought'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { getStepContent, getStepStatus } from '@/pages/optimize/utils'
import { ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader } from '../shared/primitives'
import { JOB_DESCRIPTION_ANALYSIS_STEPS } from './const'

export interface JobDescriptionAnalysisTraceProps {
  analysisError: string | null
  analysisOpen: boolean
  analysisState: AnalysisState
  onAnalysisOpenChange: (open: boolean) => void
}

function getProcessTone(status: AnalysisStatus, hasError: boolean): ToolTone {
  if (hasError) {
    return 'danger'
  }

  if (status === 'complete') {
    return 'success'
  }

  if (status === 'thinking' || status === 'generating') {
    return 'primary'
  }

  if (status === 'sending' || status === 'received') {
    return 'info'
  }

  return 'default'
}

function getProcessLabel(status: AnalysisStatus, hasError: boolean) {
  if (hasError) {
    return '分析失败'
  }

  if (status === 'complete') {
    return '已完成'
  }

  if (status === 'received') {
    return '已返回'
  }

  if (status === 'sending' || status === 'thinking' || status === 'generating') {
    return '分析中'
  }

  return '待开始'
}

function renderStepDescription(
  stepConfig: StepConfig,
  stepStatus: 'active' | 'complete' | 'pending',
  analysisState: AnalysisState,
) {
  const stepContent = getStepContent(stepConfig, analysisState)
  const isActive = stepStatus === 'active'

  if (!stepContent) {
    return null
  }

  if (stepConfig.id === 'thinking') {
    return (
      <AutoScrollContainer
        className="mt-2 max-h-[260px] overflow-x-auto rounded-md bg-muted p-3"
        dependency={stepContent}
        enabled={isActive}
      >
        <div className="markdown-content text-xs text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>li]:mb-1 [&>h1]:mb-2 [&>h1]:text-lg [&>h1]:font-bold [&>h2]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-medium [&>code]:rounded [&>code]:bg-background [&>code]:px-1 [&>code]:py-0.5 [&>code]:text-xs [&>pre]:mb-2 [&>pre]:overflow-x-auto [&>pre]:rounded [&>pre]:bg-background [&>pre]:p-2 [&>blockquote]:mb-2 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:border-l-2 [&>blockquote]:pl-3 [&>blockquote]:italic [&>strong]:font-semibold [&>em]:italic">
          <Markdown>{stepContent}</Markdown>
        </div>
      </AutoScrollContainer>
    )
  }

  if (stepConfig.id === 'result') {
    return (
      <AutoScrollContainer
        className="mt-2 max-h-[260px] rounded-md bg-muted p-3"
        dependency={stepContent}
        enabled={isActive}
      >
        <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
          {stepContent}
        </pre>
      </AutoScrollContainer>
    )
  }

  return (
    <AutoScrollContainer
      className="mt-2 max-h-[220px] rounded-md bg-muted p-3"
      dependency={stepContent}
      enabled={isActive}
    >
      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
        {stepContent}
      </div>
    </AutoScrollContainer>
  )
}

export default function AnalysisTrace({
  analysisError,
  analysisOpen,
  analysisState,
  onAnalysisOpenChange,
}: JobDescriptionAnalysisTraceProps) {
  const { content, logs, reasoning, status } = analysisState
  const processTone = getProcessTone(status, Boolean(analysisError))
  const processLabel = getProcessLabel(status, Boolean(analysisError))

  return (
    <ToolPanelCard className="border-primary/15 bg-primary/5">
      <ToolPanelHeader
        title="推导过程"
        description="实时展示模型推导过程与结构化结果返回。"
        icon={Brain}
        badge={<ToolMetaBadge tone={processTone}>{processLabel}</ToolMetaBadge>}
      />
      <ToolPanelBody className="space-y-4">
        <ChainOfThought
          open={analysisOpen}
          onOpenChange={onAnalysisOpenChange}
          className="max-w-none"
        >
          <ChainOfThoughtHeader className="rounded-lg border border-border/60 bg-background px-3 py-2">
            查看分析链路
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent className="pt-2">
            {JOB_DESCRIPTION_ANALYSIS_STEPS.map((stepConfig) => {
              const stepStatus = getStepStatus(stepConfig, status, logs, reasoning, content)

              if (stepStatus === 'pending') {
                return null
              }

              return (
                <ChainOfThoughtStep
                  key={stepConfig.id}
                  icon={stepConfig.icon}
                  label={stepConfig.label}
                  status={stepStatus}
                  description={renderStepDescription(stepConfig, stepStatus, analysisState)}
                />
              )
            })}
          </ChainOfThoughtContent>
        </ChainOfThought>

        {analysisError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
            {analysisError}
          </div>
        )}
      </ToolPanelBody>
    </ToolPanelCard>
  )
}
