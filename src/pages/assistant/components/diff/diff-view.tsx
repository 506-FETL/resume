import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { computeLineDiff } from './compute-line-diff'

export function DiffStat({ additions, deletions, className }: { additions: number, deletions: number, className?: string }) {
  if (additions === 0 && deletions === 0)
    return null
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs', className)}>
      {additions > 0 && (
        <span className="text-emerald-600 dark:text-emerald-400">
          +
          {additions}
        </span>
      )}
      {deletions > 0 && (
        <span className="text-rose-600 dark:text-rose-400">
          -
          {deletions}
        </span>
      )}
    </span>
  )
}

export function DiffView({ before, after, className }: { before: unknown, after: unknown, className?: string }) {
  const lines = computeLineDiff(before, after)
  return (
    <ScrollArea className={cn('max-h-72 rounded-lg border', className)}>
      <pre className="min-w-full font-mono text-xs leading-relaxed">
        {lines.map((line, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={`${line.type}-${idx}-${line.text}`}
            className={cn(
              'flex gap-2 px-2 py-0.5',
              line.type === 'add' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              line.type === 'remove' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
              line.type === 'context' && 'text-muted-foreground',
            )}
          >
            <span className="select-none text-muted-foreground/60">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="whitespace-pre-wrap break-words">{line.text}</span>
          </div>
        ))}
      </pre>
    </ScrollArea>
  )
}
