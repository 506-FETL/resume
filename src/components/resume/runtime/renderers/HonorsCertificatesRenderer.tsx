import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { buildCommentNodeKey, CommentableRichText, CommentableText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function HonorsCertificatesRenderer() {
  const { honors_certificates, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('honors_certificates')) {
    return null
  }

  return (
    <RuntimeSection title="荣誉证书">
      {honors_certificates.description
        ? (
            <CommentableRichText
              nodeKey={buildCommentNodeKey('honors_certificates', 'singleton', 'description')}
              fieldLabel="荣誉证书描述"
              html={honors_certificates.description}
            />
          )
        : null}
      {honors_certificates.certificates.length > 0
        ? (
            <div className="flex flex-wrap gap-2">
              {honors_certificates.certificates.map(item => (
                <span
                  key={item.entryId}
                  className="rounded-full border px-2 py-1"
                  style={{
                    fontSize: font.smallSize,
                    color: theme.textPrimary,
                    borderColor: theme.primaryColor,
                  }}
                >
                  <CommentableText
                    nodeKey={buildCommentNodeKey('honors_certificates', item.entryId, 'name')}
                    fieldLabel="荣誉证书"
                  />
                </span>
              ))}
            </div>
          )
        : null}
    </RuntimeSection>
  )
}
