import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableText, RuntimeSection } from './shared'
import { useRuntimeLayout } from './utils'

export default function JobIntentRenderer() {
  const { job_intent, getVisibility } = useTemplateResumeData()
  const layout = useRuntimeLayout()

  if (!getVisibility('job_intent') || layout.skeleton === 'single-column') {
    return null
  }

  const fields = [
    { visible: Boolean(job_intent.jobIntent), fieldKey: 'jobIntent', label: '求职意向' },
    { visible: Boolean(job_intent.intentionalCity), fieldKey: 'intentionalCity', label: '意向城市' },
    { visible: job_intent.expectedSalary > 0, fieldKey: 'expectedSalary', label: '期望薪资' },
    { visible: job_intent.dateEntry !== '不填', fieldKey: 'dateEntry', label: '到岗时间' },
  ].filter(field => field.visible)

  return (
    <RuntimeSection title="求职意向">
      {fields.length > 0
        ? (
            <p className="m-0">
              {fields.map((field, index) => {
                const nodeKey = buildCommentNodeKey('job_intent', 'singleton', field.fieldKey)
                return (
                  <span key={nodeKey}>
                    {index > 0 ? <span aria-hidden="true"> | </span> : null}
                    <CommentableText nodeKey={nodeKey} fieldLabel={field.label} />
                  </span>
                )
              })}
            </p>
          )
        : null}
    </RuntimeSection>
  )
}
