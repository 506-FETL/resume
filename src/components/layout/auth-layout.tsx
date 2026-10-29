import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-full w-full items-start justify-center px-4 py-10 sm:px-6 sm:py-20'>
      <div className='w-full max-w-sm'>{children}</div>
    </div>
  )
}
