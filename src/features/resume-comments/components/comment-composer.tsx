import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { countCommentGraphemes } from '../anchors/graphemes.ts'
import { COMMENT_BODY_MAX_GRAPHEMES } from '../const.ts'
import { useResumeCommentStore } from '../context.tsx'

export function CommentComposer({
  draftKey,
  placeholder = '输入评论',
  submitLabel = '发送',
  disabled = false,
  pending = false,
  pendingLabel = '正在发送…',
  autoFocus = false,
  initialValue,
  onSubmit,
  onCancel,
}: {
  draftKey: string
  placeholder?: string
  submitLabel?: string
  disabled?: boolean
  pending?: boolean
  pendingLabel?: string
  autoFocus?: boolean
  initialValue?: string
  onSubmit: (value: string) => Promise<boolean>
  onCancel?: () => void
}) {
  const value = useResumeCommentStore(state => state.draftsByThreadKey[draftKey] ?? initialValue ?? '')
  const setDraft = useResumeCommentStore(state => state.setDraft)
  const count = useMemo(() => countCommentGraphemes(value), [value])
  const valid = value.trim().length > 0 && count <= COMMENT_BODY_MAX_GRAPHEMES

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid || disabled)
          return
        onSubmit(value.trim()).catch(() => undefined)
      }}
    >
      <Textarea
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={count > COMMENT_BODY_MAX_GRAPHEMES}
        className="max-h-40 min-h-20 resize-y"
        onChange={event => setDraft(draftKey, event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter')
            event.currentTarget.form?.requestSubmit()
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={cn(
          'text-xs text-muted-foreground',
          count > COMMENT_BODY_MAX_GRAPHEMES && 'text-destructive',
        )}
        >
          {count.toLocaleString()}
          {' '}
          /
          {COMMENT_BODY_MAX_GRAPHEMES.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {onCancel
            ? <Button type="button" size="sm" variant="ghost" onClick={onCancel}>取消</Button>
            : null}
          <Button type="submit" size="sm" disabled={!valid || disabled || pending} aria-live="polite">
            {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
