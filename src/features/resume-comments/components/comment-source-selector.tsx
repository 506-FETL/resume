import type { AccessibleCommentScopeSummary } from '../store/types.ts'
import { Archive, FileClock, FilePenLine, MessageSquareText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useResumeCommentStore } from '../context.tsx'

export type CommentSourceOption
  = | {
    key: 'working'
    kind: 'working'
    label: string
  }
  | {
    key: `history:${number}`
    kind: 'history'
    historyVersionId: number
    label: string
    versionNo: number
    projectionReferenceDate: string
  }
  | {
    key: `share:${string}`
    kind: 'share_release'
    shareReleaseId: string
    label: string
    releaseNo: number
    archived: boolean
    projectionReferenceDate: string
  }

function findScope(
  option: CommentSourceOption,
  scopes: AccessibleCommentScopeSummary[],
) {
  if (option.kind === 'working')
    return scopes.find(scope => scope.kind === 'working')
  if (option.kind === 'history') {
    return scopes.find(scope => scope.kind === 'history'
      && scope.historyVersionId === option.historyVersionId)
  }
  return scopes.find(scope => scope.kind === 'share_release'
    && scope.shareReleaseId === option.shareReleaseId)
}

function SourceLabel({ option }: { option: CommentSourceOption }) {
  const Icon = option.kind === 'working'
    ? FilePenLine
    : option.kind === 'history'
      ? FileClock
      : MessageSquareText
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{option.label}</span>
      {option.kind === 'share_release' && option.archived
        ? <Archive className="size-3.5 shrink-0 text-muted-foreground" />
        : null}
    </span>
  )
}

export function CommentSourceSelector({
  options,
  value,
  loading,
  onChange,
}: {
  options: CommentSourceOption[]
  value: CommentSourceOption['key']
  loading: boolean
  onChange: (value: CommentSourceOption['key']) => void
}) {
  const scopes = useResumeCommentStore(state => state.accessibleScopes)
  const selected = options.find(option => option.key === value) ?? options[0]
  const histories = options.filter(option => option.kind === 'history')
  const shares = options
    .filter(option => option.kind === 'share_release')
    .sort((left, right) => {
      const leftActivity = findScope(left, scopes)?.updatedAt ?? left.projectionReferenceDate
      const rightActivity = findScope(right, scopes)?.updatedAt ?? right.projectionReferenceDate
      return Date.parse(rightActivity) - Date.parse(leftActivity)
    })

  return (
    <div className="mt-3">
      <Select value={value} disabled={loading} onValueChange={value => onChange(value as CommentSourceOption['key'])}>
        <SelectTrigger className="w-full" aria-label="评论来源">
          <SelectValue>
            {selected ? <SourceLabel option={selected} /> : '当前工作版本'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>当前工作</SelectLabel>
            {options.filter(option => option.kind === 'working').map(option => (
              <SelectItem key={option.key} value={option.key}>
                <SourceLabel option={option} />
              </SelectItem>
            ))}
          </SelectGroup>
          {histories.length > 0 && (
            <SelectGroup>
              <SelectLabel>历史版本</SelectLabel>
              {histories.map(option => (
                <SelectItem key={option.key} value={option.key}>
                  <span className="flex min-w-0 items-center gap-2">
                    <SourceLabel option={option} />
                    {(() => {
                      const scope = findScope(option, scopes)
                      return scope && scope.nextEventSeq > scope.lastReadEventSeq
                        ? <Badge variant="destructive">新</Badge>
                        : null
                    })()}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {shares.length > 0 && (
            <SelectGroup>
              <SelectLabel>分享反馈</SelectLabel>
              {shares.map(option => (
                <SelectItem key={option.key} value={option.key}>
                  <span className="flex min-w-0 items-center gap-2">
                    <SourceLabel option={option} />
                    {(() => {
                      const scope = findScope(option, scopes)
                      return scope && scope.nextEventSeq > scope.lastReadEventSeq
                        ? <Badge variant="destructive">新</Badge>
                        : null
                    })()}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
