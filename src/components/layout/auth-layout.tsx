import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
