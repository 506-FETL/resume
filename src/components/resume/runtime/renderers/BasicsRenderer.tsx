import { useResumeContext } from '@/components/resume/runtime/context/resume-context'
import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableText } from './shared'
import { useRuntimeLayout, useRuntimeStyles } from './utils'

interface CommentInlineField {
  nodeKey: string
  label: string
}

export default function BasicsRenderer() {
  const { getVisibility } = useTemplateResumeData()
  const { commentNodesByKey } = useResumeContext()
  const layout = useRuntimeLayout()
  const { font, spacing, theme } = useRuntimeStyles()

  const field = (sectionKey: string, fieldKey: string, label: string): CommentInlineField => ({
    nodeKey: buildCommentNodeKey(sectionKey, 'singleton', fieldKey),
    label,
  })
  const contactFields = [
    field('basics', 'phone', '手机号'),
    field('basics', 'email', '邮箱'),
  ].filter(item => commentNodesByKey.has(item.nodeKey))
  const singleColumnMetaFields = [
    field('basics', 'age', '年龄'),
    field('basics', 'gender', '性别'),
    field('basics', 'nation', '民族'),
    field('basics', 'height', '身高'),
    field('basics', 'weight', '体重'),
    field('basics', 'nativePlace', '籍贯'),
  ].filter(item => commentNodesByKey.has(item.nodeKey))
  const metaFields = [
    field('basics', 'gender', '性别'),
    field('basics', 'workYears', '工作年限'),
    field('basics', 'nation', '民族'),
    field('basics', 'nativePlace', '籍贯'),
  ].filter(item => commentNodesByKey.has(item.nodeKey))
  const jobIntentFields = [
    field('job_intent', 'jobIntent', '求职意向'),
    field('job_intent', 'intentionalCity', '意向城市'),
    field('job_intent', 'expectedSalary', '期望薪资'),
    field('job_intent', 'dateEntry', '到岗时间'),
  ].filter(item => commentNodesByKey.has(item.nodeKey))
  const mergedJobIntent = layout.skeleton === 'single-column' && getVisibility('job_intent')
    ? jobIntentFields
    : []

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

  if (layout.skeleton === 'single-column') {
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
            nodeKey={buildCommentNodeKey('basics', 'singleton', 'name')}
            fieldLabel="姓名"
          />
        </h1>
        {renderInlineRow(mergedJobIntent, '求职意向：')}
        {renderInlineRow(singleColumnMetaFields)}
        {renderInlineRow(contactFields)}
      </header>
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
          nodeKey={buildCommentNodeKey('basics', 'singleton', 'name')}
          fieldLabel="姓名"
        />
      </h1>
      {contactFields.length > 0
        ? (
            <div
              className="flex flex-wrap justify-center"
              style={{
                gap: spacing.itemSpacing,
                color: theme.textPrimary,
                fontSize: font.contentSize,
              }}
            >
              {contactFields.map(value => (
                <CommentableText
                  key={value.nodeKey}
                  nodeKey={value.nodeKey}
                  fieldLabel={value.label}
                />
              ))}
            </div>
          )
        : null}
      {metaFields.length > 0
        ? (
            <div
              className="flex flex-wrap justify-center"
              style={{
                gap: spacing.itemSpacing,
                color: theme.textSecondary,
                fontSize: font.smallSize,
              }}
            >
              {metaFields.map(value => (
                <CommentableText
                  key={value.nodeKey}
                  nodeKey={value.nodeKey}
                  fieldLabel={value.label}
                />
              ))}
            </div>
          )
        : null}
    </header>
  )
}
