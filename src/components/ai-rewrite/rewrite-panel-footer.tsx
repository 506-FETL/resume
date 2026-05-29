import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveDialogFooter } from '@/components/ui/responsive-dialog'

interface RewritePanelFooterProps {
  canRetry: boolean
  isStreaming: boolean
  onRetry: () => void
}

export function RewritePanelFooter({ canRetry, isStreaming, onRetry }: RewritePanelFooterProps) {
  return (
    <ResponsiveDialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-6 py-3 sm:justify-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canRetry || isStreaming}
        onClick={onRetry}
      >
        <RotateCw className="size-4" />
        重新生成
      </Button>
    </ResponsiveDialogFooter>
  )
}
