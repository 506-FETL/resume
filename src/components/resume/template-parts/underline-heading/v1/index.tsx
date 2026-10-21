import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

export default function UnderlineHeading({ title }: { title: string }) {
  const { font, spacing, theme } = useResumeContext()
  return (
    <h2
      data-pagination-atomic
      className="m-0 border-b-2"
      style={{ fontSize: font.sectionTitleSize, fontWeight: font.boldWeight, color: theme.primaryColor, marginBottom: spacing.sectionTitleMargin, paddingBottom: `calc(${spacing.itemSpacing} / 2)`, borderColor: theme.primaryColor }}
    >
      {title}
    </h2>
  )
}
