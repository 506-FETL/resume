import type { VariantTreeNode } from '@/lib/supabase/resume/variant'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

const STATUS_VARIANT: Record<
  string,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  ready: 'default',
  generating: 'secondary',
  failed: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  ready: '已就绪',
  generating: '生成中',
  failed: '失败',
}

interface VariantLineageTreeProps {
  node: VariantTreeNode
  currentResumeId: string
  onOpen: (resumeId: string) => void
  depth?: number
}

export function VariantLineageTree({
  node,
  currentResumeId,
  onOpen,
  depth = 0,
}: VariantLineageTreeProps) {
  const reduceMotion = useReducedMotion()
  const isCurrent = node.resumeId === currentResumeId
  const status = node.derivedStatus

  const matchPct =
    node.matchRate == null ? null : `${Math.round(node.matchRate * 100)}%`

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3',
        depth > 0 && 'border-l border-border pl-3 sm:pl-5',
      )}
    >
      {depth > 0 && (
        <span
          className='absolute -left-px top-7 h-px w-3 bg-border sm:w-5'
          aria-hidden
        />
      )}
      <Card
        data-current={isCurrent}
        style={{ transitionDuration: reduceMotion ? '0s' : undefined }}
        className={cn(
          'min-w-0 w-full gap-3 py-4 shadow-none transition-colors duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)',
          isCurrent ? 'border-primary bg-primary/5' : 'hover:bg-accent/30',
        )}
      >
        <CardHeader className='flex flex-col gap-2 px-4'>
          <CardTitle className='min-w-0 wrap-anywhere leading-relaxed'>
            {node.displayName || '未命名简历'}
          </CardTitle>
          {isCurrent && <CardDescription>当前简历</CardDescription>}
          <div className='flex flex-wrap items-center gap-2'>
            {status && (
              <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
                {STATUS_LABEL[status] ?? status}
              </Badge>
            )}
            {matchPct && <Badge variant='outline'>关键词覆盖 {matchPct}</Badge>}
            {!isCurrent && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => onOpen(node.resumeId)}
                aria-label={`打开 ${node.displayName || '未命名简历'}`}
              >
                打开
                <ArrowRight />
              </Button>
            )}
          </div>
        </CardHeader>
        {node.jdSnippet && (
          <CardContent className='px-4'>
            <p className='line-clamp-2 text-sm text-muted-foreground'>
              JD：
              {node.jdSnippet}
            </p>
          </CardContent>
        )}
      </Card>

      {node.children.length > 0 && (
        <div className='flex flex-col gap-3'>
          {node.children.map((child) => (
            <VariantLineageTree
              key={child.resumeId}
              node={child}
              currentResumeId={currentResumeId}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function findPath(
  node: VariantTreeNode,
  targetId: string,
  acc: VariantTreeNode[] = [],
): VariantTreeNode[] | null {
  const next = [...acc, node]

  if (node.resumeId === targetId) return next

  for (const c of node.children) {
    const r = findPath(c, targetId, next)

    if (r) return r
  }

  return null
}

interface VariantLineagePathProps {
  tree: VariantTreeNode | null
  currentResumeId: string
}

export function VariantLineagePath({
  tree,
  currentResumeId,
}: VariantLineagePathProps) {
  const path = useMemo(
    () => (tree ? (findPath(tree, currentResumeId) ?? []) : []),
    [tree, currentResumeId],
  )

  if (path.length === 0) {
    return <p className='text-xs text-muted-foreground'>暂无派生关系</p>
  }

  return (
    <ol className='flex flex-col gap-2'>
      {path.map((n, i) => (
        <li key={n.resumeId} className='flex min-w-0 items-center gap-2'>
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full text-xs',
              i === path.length - 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            aria-hidden
          >
            {i + 1}
          </span>
          <Badge
            variant={i === path.length - 1 ? 'default' : 'outline'}
            className='min-w-0 flex-1 shrink justify-start'
            title={n.displayName || '未命名'}
          >
            <span className='truncate'>{n.displayName || '未命名'}</span>
          </Badge>
          {n.matchRate != null && (
            <span
              className='shrink-0 text-xs tabular-nums text-muted-foreground'
              aria-label={`关键词覆盖率 ${Math.round(n.matchRate * 100)}%`}
            >
              {Math.round(n.matchRate * 100)}%
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
