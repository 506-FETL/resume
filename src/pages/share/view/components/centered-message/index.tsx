export default function CenteredMessage({ title, text }: { title?: string, text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
