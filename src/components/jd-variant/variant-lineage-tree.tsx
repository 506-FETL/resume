import type { VariantTreeNode } from '@/lib/supabase/resume/variant'
import { ArrowRight, GitBranch } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
    <div className="space-y-1">
      <div
        data-current={isCurrent}
        className={
          isCurrent
            ? 'flex items-center gap-2 rounded border border-primary bg-primary/5 p-2'
            : 'flex items-center gap-2 rounded border p-2'
        }
        style={{ marginLeft: depth * 16 }}
      >
        <GitBranch className="size-3 text-muted-foreground" aria-hidden />
        <span className="font-medium truncate flex-1">{node.displayName || '未命名简历'}</span>
        {status && (
          <Badge variant={STATUS_VARIANT[status] ?? 'outline'} className="text-xs">
            {STATUS_LABEL[status] ?? status}
          </Badge>
        )}
        {matchPct && <span className="text-xs text-muted-foreground">{matchPct}</span>}
        {!isCurrent && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() => onOpen(node.resumeId)}
            aria-label={`打开 ${node.displayName}`}
          >
            <ArrowRight className="size-3" />
          </Button>
        )}
      </div>
      {node.jdSnippet && (
        <p className="text-xs text-muted-foreground line-clamp-2" style={{ marginLeft: depth * 16 + 24 }}>
          JD：
          {node.jdSnippet}
        </p>
      )}
      {node.children.length > 0 && (
        <div className="space-y-1">
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

export function findPath(node: VariantTreeNode, targetId: string, acc: VariantTreeNode[] = []): VariantTreeNode[] | null {
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
    <ol className="space-y-1 text-xs">
      {path.map((n, i) => (
        <li key={n.resumeId} className="flex items-center gap-2">
          <Badge variant={i === path.length - 1 ? 'default' : 'outline'} className="truncate">
            {n.displayName || '未命名'}
          </Badge>
          {n.matchRate != null && (
            <span className="text-muted-foreground">
              {Math.round(n.matchRate * 100)}
              %
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
