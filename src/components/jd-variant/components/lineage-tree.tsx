import type { VariantTreeNode } from '@/lib/supabase/resume/variant'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
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

export function VariantLineageTree({ node, currentResumeId, onOpen, depth = 0 }: VariantLineageTreeProps) {
  const isCurrent = node.resumeId === currentResumeId
  const status = node.derivedStatus
  const matchPct = node.matchRate == null ? null : `${Math.round(node.matchRate * 100)}%`

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3',
        depth > 0 && 'border-l border-border pl-5',
      )}
    >
      {depth > 0 && <span className="absolute -left-px top-7 h-px w-5 bg-border" aria-hidden />}
      <Card
        data-current={isCurrent}
        className={cn(
          'min-w-[28rem] gap-4 py-4 shadow-none transition-colors',
          isCurrent ? 'border-primary bg-primary/5' : 'hover:bg-accent/30',
        )}
      >
        <CardHeader className="px-4">
          <CardTitle className="truncate">{node.displayName || '未命名简历'}</CardTitle>
          <CardDescription>{isCurrent ? '当前简历' : '派生关系中的简历'}</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              {status && (
                <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
                  {STATUS_LABEL[status] ?? status}
                </Badge>
              )}
              {matchPct && <Badge variant="outline">{matchPct}</Badge>}
              {!isCurrent && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onOpen(node.resumeId)}
                  aria-label={`打开 ${node.displayName || '未命名简历'}`}
                >
                  <ArrowRight />
                </Button>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-4">
          {node.jdSnippet
            ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  JD：
                  {node.jdSnippet}
                </p>
              )
            : <p className="text-sm text-muted-foreground">没有关联的职位描述摘要。</p>}
        </CardContent>
      </Card>

      {node.children.length > 0 && (
        <div className="flex flex-col gap-3">
          {node.children.map(child => (
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

function findPath(node: VariantTreeNode, targetId: string, acc: VariantTreeNode[] = []): VariantTreeNode[] | null {
  const next = [...acc, node]
  if (node.resumeId === targetId)
    return next
  for (const c of node.children) {
    const r = findPath(c, targetId, next)
    if (r)
      return r
  }
  return null
}

interface VariantLineagePathProps {
  tree: VariantTreeNode | null
  currentResumeId: string
}

export function VariantLineagePath({ tree, currentResumeId }: VariantLineagePathProps) {
  const path = useMemo(
    () => (tree ? findPath(tree, currentResumeId) ?? [] : []),
    [tree, currentResumeId],
  )
  if (path.length === 0) {
    return <p className="text-xs text-muted-foreground">无血缘信息</p>
  }

  return (
    <ol className="flex flex-col gap-2">
      {path.map((n, i) => (
        <li key={n.resumeId} className="flex items-center gap-2">
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
          <Badge variant={i === path.length - 1 ? 'default' : 'outline'} className="max-w-45 truncate">
            {n.displayName || '未命名'}
          </Badge>
          {n.matchRate != null && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(n.matchRate * 100)}
              %
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
