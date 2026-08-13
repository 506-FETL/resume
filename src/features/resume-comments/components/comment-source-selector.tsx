import type { AccessibleCommentScopeSummary } from '../store/types.ts'
import { FileClock, FilePenLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useResumeCommentStore } from '../context.tsx'

export type CommentSourceOption
  = | {
    key: 'working'
    kind: 'working'
    label: string
    versionId?: number
  }
  | {
    key: `history:${number}`
    kind: 'history'
    historyVersionId: number
    label: string
    versionNo: number
    projectionReferenceDate: string
  }

function findScope(
  option: CommentSourceOption,
  scopes: AccessibleCommentScopeSummary[],
) {
  if (option.kind === 'working')
    return scopes.find(scope => !option.versionId || scope.versionId === option.versionId)
  return scopes.find(scope => scope.versionId === option.historyVersionId)
}

function SourceLabel({ option }: { option: CommentSourceOption }) {
  const Icon = option.kind === 'working' ? FilePenLine : FileClock
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{option.label}</span>
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
        </SelectContent>
      </Select>
    </div>
  )
}
