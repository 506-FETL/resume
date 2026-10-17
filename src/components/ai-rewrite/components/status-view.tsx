import type { RewriteSessionState } from '../types'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface RewriteStatusViewProps {
  state: RewriteSessionState
}

export function RewriteStatusView({ state }: RewriteStatusViewProps) {
  if (state.status === 'streaming') {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>正在生成改写方案…</span>
      </div>
    )
  }

  if (state.status === 'waiting_jd') {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>填写 JD 后即可生成</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>AI 改写失败</AlertTitle>
        {state.errorMessage && (
          <AlertDescription>{state.errorMessage}</AlertDescription>
        )}
      </Alert>
    )
  }

  if (state.status === 'success' && state.candidates.length === 0) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        <span>未生成有效内容，请重试</span>
      </div>
    )
  }

  return null
}
