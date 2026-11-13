import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from '@/components/ui/code-block'
import { cn } from '@/lib/utils'
import { computeLineDiff } from './compute-line-diff'

export function DiffStat({
  additions,
  deletions,
  className,
}: {
  additions: number
  deletions: number
  className?: string
}) {
  if (additions === 0 && deletions === 0) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs',
        className,
      )}
    >
      {additions > 0 && (
        <span className='text-emerald-600 dark:text-emerald-400'>
          +{additions}
        </span>
      )}
      {deletions > 0 && (
        <span className='text-rose-600 dark:text-rose-400'>-{deletions}</span>
      )}
    </span>
  )
}

export function DiffView({
  before,
  after,
  className,
}: {
  before: unknown
  after: unknown
  className?: string
}) {
  const lines = computeLineDiff(before, after)

  return (
    <CodeBlock size='sm' className={className}>
      <CodeBlockContent wrap className='max-h-72'>
        {lines.map((line, idx) => (
          <CodeBlockLine
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${line.type}-${idx}-${line.text}`}
            variant={
              line.type === 'add'
                ? 'added'
                : line.type === 'remove'
                  ? 'removed'
                  : 'default'
            }
            className={cn(
              'py-0.5',
              line.type === 'add' &&
                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              line.type === 'remove' &&
                'bg-rose-500/10 text-rose-700 dark:text-rose-300',
              line.type === 'context' && 'text-muted-foreground',
            )}
          >
            {line.text}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
