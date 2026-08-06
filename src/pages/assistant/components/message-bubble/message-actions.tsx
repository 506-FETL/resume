import type { AiMessage } from '@/lib/ai/types'
import dayjs from 'dayjs'
import { Check, Copy, Pencil, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MessageActionsProps {
  message: AiMessage
  onEdit?: () => void
  onRegenerate?: () => void
}

function getPlainText(message: AiMessage): string {
  return message.parts
    .filter(p => p.type === 'text')
    .map(p => (p as { text: string }).text)
    .join('\n')
}

export function MessageActions({ message, onEdit, onRegenerate }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText(message))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch {
      // 剪贴板不可用时静默失败
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100',
        isUser && 'justify-end',
      )}
    >
      <span className="ml-0.5 text-[11px] tabular-nums">
        {dayjs(message.createdAt).format('YYYY-MM-DD HH:mm:ss')}
      </span>
      <Button variant="ghost" size="icon-xs" aria-label="复制" title="复制" onClick={handleCopy}>
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      </Button>
      {isUser && onEdit && (
        <Button variant="ghost" size="icon-xs" aria-label="编辑" title="编辑并重新生成" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
      )}
      {!isUser && onRegenerate && (
        <Button variant="ghost" size="icon-xs" aria-label="重新生成" title="重新生成" onClick={onRegenerate}>
          <RefreshCw className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
