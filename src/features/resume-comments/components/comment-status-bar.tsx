import { CheckCircle2, LoaderCircle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function CommentStatusBar({
  replyCount,
  canResolve,
  resolving,
  error,
  onResolve,
}: {
  replyCount: number
  canResolve: boolean
  resolving: boolean
  error?: string | null
  onResolve: () => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5">
      {error ? <span role="alert" className="mr-auto truncate text-xs text-destructive">{error}</span> : null}
      {canResolve
        ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={resolving ? '正在解决评论' : '解决评论'}
                  disabled={resolving}
                  onClick={(event) => {
                    event.stopPropagation()
                    onResolve()
                  }}
                >
                  {resolving
                    ? <LoaderCircle className="animate-spin" />
                    : <CheckCircle2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{resolving ? '正在解决…' : '标记为已解决'}</TooltipContent>
            </Tooltip>
          )
        : null}
      {replyCount > 0
        ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5" />
              {replyCount}
              {' '}
              条回复
            </span>
          )
        : null}
    </div>
  )
}
