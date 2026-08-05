import { ArrowRight } from 'lucide-react'

interface ResumeFieldDiffProps {
  before: unknown
  after: unknown
}

function toText(v: unknown): string {
  if (v == null)
    return '（空）'
  if (typeof v === 'string')
    return v || '（空）'
  return JSON.stringify(v, null, 2)
}

function DiffPane({ label, tone, content }: { label: string, tone: 'before' | 'after', content: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border bg-background/60 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={
            tone === 'before'
              ? 'inline-block size-1.5 rounded-full bg-muted-foreground/50'
              : 'inline-block size-1.5 rounded-full bg-primary'
          }
        />
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-foreground/90">
        {content}
      </pre>
    </div>
  )
}

export function ResumeFieldDiff({ before, after }: ResumeFieldDiffProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <DiffPane label="原内容" tone="before" content={toText(before)} />
      <div className="flex shrink-0 items-center justify-center text-muted-foreground">
        <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
      </div>
      <DiffPane label="新内容" tone="after" content={toText(after)} />
    </div>
  )
}
