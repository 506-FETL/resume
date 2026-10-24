import type { FieldRendererProps } from './types'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { cn } from '@/lib/utils'
import { isEmptyValue } from '@/pages/optimize/utils'
import { EmptyValue } from './types'

export function HtmlStringValue({
  value,
  variant,
}: FieldRendererProps<string>) {
  if (isEmptyValue(value)) return <EmptyValue />

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none wrap-break-word text-xs dark:prose-invert',
        '[&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5',
        variant === 'before' && 'opacity-60',
      )}
    >
      {parseSanitizedHtml(value)}
    </div>
  )
}
