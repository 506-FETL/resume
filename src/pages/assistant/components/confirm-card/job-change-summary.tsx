interface JobChangeSummaryProps {
  summary: string
}

export function JobChangeSummary({ summary }: JobChangeSummaryProps) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5 text-sm leading-relaxed text-foreground/90">
      {summary}
    </div>
  )
}
