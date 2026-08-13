import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function ApplicationInfoRenderer() {
  const { application_info, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('application_info')) {
    return null
  }

  const fields = [
    {
      visible: Boolean(application_info.applicationSchool),
      nodeKey: buildCommentNodeKey('application_info', 'singleton', 'applicationSchool'),
      label: '申请院校',
    },
    {
      visible: Boolean(application_info.applicationMajor),
      nodeKey: buildCommentNodeKey('application_info', 'singleton', 'applicationMajor'),
      label: '申请专业',
    },
  ].filter(field => field.visible)

  return (
    <RuntimeSection title="申请信息">
      <div className="flex flex-wrap gap-2">
        {fields.map(field => (
          <span
            key={field.nodeKey}
            className="rounded-full border px-2 py-1"
            style={{
              fontSize: font.smallSize,
              color: theme.textPrimary,
              borderColor: theme.primaryColor,
            }}
          >
            <CommentableText nodeKey={field.nodeKey} fieldLabel={field.label} />
          </span>
        ))}
      </div>
    </RuntimeSection>
  )
}
