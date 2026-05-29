import type { HistoryResumeOption } from '../../types'
import { AlertCircle, Clock3, FileText, Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime } from '@/utils/date'
import { getResumeTypeLabel } from '../../utils'

interface HistoryResumeSelectorProps {
  value: string | null
  options: HistoryResumeOption[]
  loading: boolean
  error: string | null
  onChange: (resumeId: string) => void
}

export default function HistoryResumeSelector({ value, options, loading, error, onChange }: HistoryResumeSelectorProps) {
  const selectValue = value ?? ''
  const selectedResume = options.find(option => option.resumeId === value) ?? null
  const helperText = error || (options.length > 0
    ? `共 ${options.length} 份云端简历`
    : '暂无可查看的云端简历。')

  const optionItems = options.map(option => (
    <SelectItem key={option.resumeId} value={option.resumeId} textValue={option.displayName}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1.5 pr-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{option.displayName}</span>
          <Badge variant="outline" className="shrink-0">
            {getResumeTypeLabel(option.type)}
          </Badge>
        </div>
        <span className="line-clamp-1 text-xs leading-5 text-muted-foreground">
          {option.description || '暂无说明'}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" />
          <span className="truncate">
            {option.updatedAt ? formatDateTime(option.updatedAt) : '暂无更新时间'}
          </span>
        </span>
      </div>
    </SelectItem>
  ))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          <Layers3 className="size-4" />
          切换简历
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          切换要查看版本记录的简历。
        </p>
      </div>

      <FieldGroup className="gap-3">
        <Field data-invalid={Boolean(error)} className="gap-2.5">
          <FieldLabel htmlFor="history-resume-selector" className="sr-only">
            选择简历
          </FieldLabel>

          <div className="w-full max-w-2xl">
            <Select value={selectValue} onValueChange={onChange} disabled={loading || options.length === 0}>
              <SelectTrigger
                id="history-resume-selector"
                aria-invalid={Boolean(error)}
                className="h-auto min-h-18 w-full rounded-2xl border-primary/10 bg-background/95 px-3 py-3 shadow-xs transition-colors hover:border-primary/20 hover:bg-primary/4"
              >
                <SelectValue placeholder={loading ? '正在加载简历...' : '选择简历'}>
                  {selectedResume && (
                    <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/6 shadow-xs">
                        <FileText className="text-primary" />
                      </div>

                      <div className="min-w-0 flex flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-base font-semibold">{selectedResume.displayName}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {getResumeTypeLabel(selectedResume.type)}
                          </Badge>
                        </div>

                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {selectedResume.updatedAt
                              ? `最近更新 ${formatDateTime(selectedResume.updatedAt)}`
                              : '暂无更新时间'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>

              <SelectContent className="scrollbar-thin-subtle max-h-[min(60vh,420px)] w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)] rounded-2xl border-border/70 bg-background/95 p-1.5 shadow-xl backdrop-blur">
                <SelectGroup>{optionItems}</SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <FieldDescription className="flex items-start gap-2 text-xs leading-5">
            {error && <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />}
            <span>{helperText}</span>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </section>
  )
}
