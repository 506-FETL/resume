import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableRichText, RuntimeSection } from './shared'

export default function SelfEvaluationRenderer() {
  const { self_evaluation, getVisibility } = useTemplateResumeData()

  if (!getVisibility('self_evaluation')) {
    return null
  }

  return (
    <RuntimeSection title="自我评价">
      {self_evaluation.content
        ? (
            <CommentableRichText
              nodeKey={buildCommentNodeKey('self_evaluation', 'singleton', 'content')}
              fieldLabel="自我评价"
              html={self_evaluation.content}
            />
          )
        : null}
    </RuntimeSection>
  )
}
