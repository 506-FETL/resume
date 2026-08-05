import type React from 'react'

export function AssistantShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-dvh w-full overflow-hidden bg-background text-foreground">
      {children}
    </main>
  )
}
