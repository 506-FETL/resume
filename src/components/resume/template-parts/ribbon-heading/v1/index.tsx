import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export default function RibbonHeading({ title }: { title: string }) {
  const { theme, font, spacing } = useResumeContext()
  return (
    <h2 data-pagination-atomic className="relative m-0" style={{ marginLeft: -33, marginBottom: spacing.sectionTitleMargin, borderBottom: `1px solid ${theme.primaryColor}`, fontSize: font.sectionTitleSize, fontWeight: font.mediumWeight, lineHeight: 1.6 }}>
      <span className="relative inline-block" style={{ padding: '0 42px 0 22px', color: '#ffffff', background: theme.primaryColor, clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 100%, 0 100%)' }}>
        {title}
        <svg aria-hidden data-resume-decoration className="absolute top-0 right-0 h-full w-10" viewBox="0 0 40 26" preserveAspectRatio="none">
          <path d="M8 0 34 26 M15 0 41 26" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.8" />
        </svg>
      </span>
      <span aria-hidden data-resume-decoration className="absolute top-full left-0" style={{ width: 14, height: 8, background: theme.primaryColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%)', filter: 'brightness(0.75)' }} />
    </h2>
  )
}
