import type { ReactNode } from 'react'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export default function RuledColumnLayout({ header, main }: { header?: ReactNode, main: ReactNode }) {
  const { spacing, theme } = useResumeContext()
  return (
    <div style={{ lineHeight: spacing.lineHeight, color: theme.textPrimary }}>
      {header}
      <div className="flex flex-col" style={{ marginLeft: 14, paddingLeft: 18, borderLeft: `1px solid ${theme.primaryColor}`, gap: spacing.sectionMargin }}>
        {main}
      </div>
    </div>
  )
}
