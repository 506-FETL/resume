import type { FieldChange } from './compute-field-diff'
import { ArrowRight } from 'lucide-react'
import { computeFieldDiff } from './compute-field-diff'
import { SECTION_LABELS } from './field-labels'

export function FieldDiffView({ sectionKey, before, after }: { sectionKey: string, before: unknown, after: unknown }) {
  const sectionLabel = SECTION_LABELS[sectionKey] ?? sectionKey
  const changes = computeFieldDiff(sectionLabel, before, after)

  if (changes.length === 0)
    return <p className="text-muted-foreground">无字段变更</p>

  return (
    <ul className="flex flex-col gap-2">
      {changes.map(c => (
        <li key={`${c.path}-${c.kind}`} className="rounded-md border bg-muted/30 p-2 text-xs">
          <div className="mb-1 font-medium text-foreground">{c.path}</div>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-rose-600 line-through decoration-rose-300">
              {c.before}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-emerald-600">
              {c.after}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function fieldChangeCount(sectionKey: string, before: unknown, after: unknown): number {
  const label = SECTION_LABELS[sectionKey] ?? sectionKey
  return computeFieldDiff(label, before, after).length
}

export type { FieldChange }
