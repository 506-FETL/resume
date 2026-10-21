import type { ReactNode } from 'react'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

interface SingleColumnLayoutProps {
  header?: ReactNode
  main: ReactNode
}

export default function SingleColumnLayout({ header, main }: SingleColumnLayoutProps) {
  const { spacing } = useResumeContext()

  return (
    <div className="flex flex-col" style={{ lineHeight: spacing.lineHeight }}>
      {header}
      <div className="flex flex-col" style={{ gap: spacing.sectionMargin }}>
        {main}
      </div>
    </div>
  )
}
