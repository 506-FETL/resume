import { useMemo } from 'react'
import Markdown from 'react-markdown'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai/chain-of-thought'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { ANALYSIS_STEPS_CONFIG } from '../../../const'
import useAtsStore from '../../../store'
import { getStepContent, getStepStatus } from '../../../utils'

interface AnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AnalysisDialog({ open, onOpenChange }: AnalysisDialogProps) {
  const analysisState = useAtsStore(s => s.analysisState)
  const selectedResumeType = useAtsStore(s => s.selectedResumeType)
  const { status, logs, reasoning, content } = analysisState

  const visibleSteps = useMemo(() => {
    return ANALYSIS_STEPS_CONFIG.filter((step) => {
      if (step.showCondition) {
        return step.showCondition(analysisState, selectedResumeType)
      }
      return true
    })
  }, [analysisState, selectedResumeType])

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:h-[85vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <ResponsiveDialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
          <ResponsiveDialogTitle>ATS 分析过程</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            分析结果仅供参考，请核对后再应用修改。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ChainOfThought open className="w-full p-6 overflow-y-auto">
          <ChainOfThoughtContent>
            {visibleSteps.map((stepConfig) => {
              const stepStatus = getStepStatus(stepConfig, status, logs, reasoning, content)

              if (stepStatus === 'pending') {
                return null
              }

              const stepContent = getStepContent(stepConfig, analysisState)
              const isActive = stepStatus === 'active'

              const renderStepContent = () => {
                if (!stepContent)
                  return null

                if (stepConfig.id === 'thinking') {
                  return (
                    <AutoScrollContainer
                      className="max-h-75 bg-muted p-3 rounded-md mt-2 overflow-x-auto"
                      dependency={stepContent}
                      enabled={isActive}
                    >
                      <div className="markdown-content text-xs text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1 [&>code]:bg-background [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>pre]:bg-background [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto [&>pre]:mb-2 [&>blockquote]:border-l-2 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:mb-2 [&>strong]:font-semibold [&>em]:italic">
                        <Markdown>{stepContent}</Markdown>
                      </div>
                    </AutoScrollContainer>
                  )
                }

                if (stepConfig.id === 'result') {
                  return (
                    <AutoScrollContainer
                      className="max-h-75 bg-muted p-3 rounded-md mt-2"
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
                    className="max-h-75 bg-muted p-3 rounded-md mt-2"
                    dependency={stepContent}
                    enabled={isActive}
                  >
                    <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                      {stepContent}
                    </div>
                  </AutoScrollContainer>
                )
              }

              return (
                <ChainOfThoughtStep
                  key={stepConfig.id}
                  icon={stepConfig.icon}
                  label={stepConfig.label}
                  status={stepStatus}
                  description={renderStepContent()}
                />
              )
            })}
          </ChainOfThoughtContent>
        </ChainOfThought>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
