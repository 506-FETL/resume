import type { ResumeSchema } from '@/lib/schema'
import { Brain, FileText, Loader2, RefreshCcw, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtStep } from '@/components/ai/chain-of-thought'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Button } from '@/components/ui/button'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { runAtsStructured } from '@/lib/llm'
import data from './data'
import { ResumeManager } from './resume-manager'

function Header() {
  const [reasoning, setReasoning] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'thinking' | 'generating' | 'complete'>('idle')
  const [isOpen, setIsOpen] = useState(false)

  const handleStartAnalysis = async () => {
    setStatus('thinking')
    setIsOpen(true)
    setReasoning('')
    setContent('')

    await runAtsStructured(data as ResumeSchema, ({ content, reasoning }) => {
      if (reasoning) {
        setReasoning(reasoning)
      }
      if (content) {
        setStatus('generating')
        setContent(content)
      }
    })

    setStatus('complete')
  }

  const handleViewAnalysis = () => {
    setIsOpen(true)
  }

  const hasAnalysis = status !== 'idle' && (reasoning || content)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">ATS 优化助手</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-11 max-w-lg">
            基于 AI 深度分析，为您提供专业的简历优化建议，提升通过 ATS 筛选的概率。
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pl-11 sm:pl-0">
          <ResumeManager />

          {hasAnalysis && (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
              onClick={handleViewAnalysis}
            >
              <Search className="mr-2 h-4 w-4" />
              查看分析
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4"
            onClick={handleStartAnalysis}
            disabled={status === 'thinking' || status === 'generating'}
          >
            {status === 'thinking' || status === 'generating'
              ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )
              : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
            重新检测
          </Button>
        </div>
      </div>

      <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDialogContent className="max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>ATS 分析过程</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <ChainOfThought defaultOpen className="w-full p-4">
            <ChainOfThoughtContent>
              {reasoning && (
                <ChainOfThoughtStep
                  icon={Brain}
                  label="AI 思考过程"
                  status={status === 'thinking' ? 'active' : 'complete'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[300px] bg-muted p-3 rounded-md mt-2"
                      dependency={reasoning}
                      enabled={status === 'thinking'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {reasoning}
                      </div>
                    </AutoScrollContainer>
                  )}
                />
              )}

              {content && (
                <ChainOfThoughtStep
                  icon={FileText}
                  label="生成分析报告"
                  status={status === 'generating' ? 'active' : status === 'complete' ? 'complete' : 'pending'}
                  description={(
                    <AutoScrollContainer
                      className="max-h-[220px] bg-muted p-3 rounded-md mt-2"
                      dependency={content}
                      enabled={status === 'generating'}
                    >
                      <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {content}
                      </div>
                    </AutoScrollContainer>
                  )}
                />
              )}
            </ChainOfThoughtContent>
          </ChainOfThought>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}

export default Header
