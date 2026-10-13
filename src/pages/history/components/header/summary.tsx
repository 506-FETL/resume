import { History } from 'lucide-react'

export default function HistoryHeaderSummary() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground">
        <History className="size-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">历史版本</h1>
        <p className="mt-1 text-sm text-muted-foreground">留存每一次修改，随时对比与恢复。</p>
      </div>
    </div>
  )
}
