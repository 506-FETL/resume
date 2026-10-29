import type { AiMessage } from '@/lib/ai/types'
import dayjs from 'dayjs'
import { Check, Copy, Pencil, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { readableMessageText } from '../../composer-references'
import { Button } from '@/components/ui/button'
import { getSkillReferences } from '@/lib/ai/skills/references'
import { cn } from '@/lib/utils'

interface MessageActionsProps {
  message: AiMessage
  onEdit?: () => void
  onRegenerate?: () => void
}

function getPlainText(message: AiMessage): string {
  const text = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('\n')

  if (message.role === 'user') {
    return [
      ...getSkillReferences(message.parts).map((skill) => skill.displayName),
      readableMessageText(text),
    ]
      .filter(Boolean)
      .join('\n')
  }

  return text
}

export function MessageActions({
  message,
  onEdit,
  onRegenerate,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getPlainText(message))
      setCopied(true)

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)

      resetTimerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('复制失败，请选择消息文字后复制')
    }
  }

  return (
    <div
      className={cn(
        'flex max-w-full flex-wrap items-center gap-1 text-muted-foreground opacity-100 transition-opacity group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100',
        isUser && 'justify-end',
      )}
    >
      <span className='ml-0.5 text-[11px] tabular-nums'>
        {dayjs(message.createdAt).format('YYYY-MM-DD HH:mm:ss')}
      </span>
      <Button
        variant='ghost'
        size='icon-xs'
        aria-label={copied ? '已复制' : '复制'}
        title='复制'
        onClick={handleCopy}
      >
        <AnimatedContent
          animationKey={copied ? 'copied' : 'copy'}
          as='span'
          className='flex size-3.5 items-center justify-center'
        >
          {copied ? (
            <Check className='size-3.5 text-primary' />
          ) : (
            <Copy className='size-3.5' />
          )}
        </AnimatedContent>
      </Button>
      {isUser && onEdit && (
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label='编辑'
          title='编辑并重新生成'
          onClick={onEdit}
        >
          <Pencil className='size-3.5' />
        </Button>
      )}
      {!isUser && onRegenerate && (
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label='重新生成'
          title='重新生成'
          onClick={onRegenerate}
        >
          <RefreshCw className='size-3.5' />
        </Button>
      )}
    </div>
  )
}
