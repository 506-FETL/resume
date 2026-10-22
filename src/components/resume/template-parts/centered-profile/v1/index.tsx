import type { ContentField, ProfileContent } from '@/lib/resume-template/content/types'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'

type CommentInlineField = ContentField

export default function CenteredProfile({ profile }: { profile: ProfileContent }) {
  const { font, spacing, theme } = useResumeContext()
  const renderInlineRow = (values: CommentInlineField[], prefix?: string) => {
    if (values.length === 0) {
      return null
    }

    const [firstValue, ...restValues] = values
    const separatorPadding = `calc(${spacing.itemSpacing} * 0.55)`

    return (
      <div
        className="flex flex-wrap justify-center items-center"
        style={{
          columnGap: 0,
          rowGap: spacing.paragraphSpacing,
          color: theme.textSecondary,
          fontSize: font.contentSize,
          fontWeight: font.mediumWeight,
          lineHeight: spacing.lineHeight,
        }}
      >
        {prefix
          ? (
              <div key={`${prefix}-first-${firstValue.nodeKey}`} className="flex items-center">
                <span
                  style={{
                    color: theme.textPrimary,
                    paddingInlineEnd: separatorPadding,
                  }}
                >
                  {prefix}
                </span>
                <CommentableText nodeKey={firstValue.nodeKey} fieldLabel={firstValue.label} />
              </div>
            )
          : (
              <CommentableText
                key={`${prefix ?? 'row'}-${firstValue.nodeKey}`}
                nodeKey={firstValue.nodeKey}
                fieldLabel={firstValue.label}
              />
            )}
        {restValues.map(value => (
          <div key={`${prefix ?? 'row'}-${value.nodeKey}`} className="flex items-center">
            <span
              aria-hidden="true"
              style={{
                color: theme.textMuted,
                fontWeight: font.normalWeight,
                paddingInline: separatorPadding,
              }}
            >
              |
            </span>
            <CommentableText nodeKey={value.nodeKey} fieldLabel={value.label} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <header
      id="resume-section-basics"
      className="flex flex-col items-center text-center"
      style={{
        marginBottom: spacing.sectionMargin,
        gap: spacing.paragraphSpacing,
      }}
    >
      <h1
        className="m-0"
        style={{
          fontSize: font.nameSize,
          fontWeight: font.boldWeight,
          color: theme.primaryColor,
        }}
      >
        <CommentableText
          nodeKey={profile.name?.nodeKey ?? ''}
          fieldLabel="姓名"
        />
      </h1>
      {renderInlineRow(profile.jobIntent, '求职意向：')}
      {renderInlineRow(profile.meta)}
      {renderInlineRow(profile.contact)}
    </header>
  )
}
