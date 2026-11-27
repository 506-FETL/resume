import type { ReactNode } from 'react'
import { PageLayout } from './page-layout'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PageLayout className='min-h-full'>
      <div className='m-auto w-full max-w-sm'>{children}</div>
    </PageLayout>
  )
}
