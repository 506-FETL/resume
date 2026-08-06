import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { RuntimeRichText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function HonorsCertificatesRenderer() {
  const { honors_certificates, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('honors_certificates')) {
    return null
  }

  return (
    <RuntimeSection title="荣誉证书">
      {honors_certificates.description ? <RuntimeRichText html={honors_certificates.description} /> : null}
      {honors_certificates.certificates.length > 0
        ? (
            <div className="flex flex-wrap gap-2">
              {honors_certificates.certificates.map((item, index) => (
                <span
                  // 空/重复条目无稳定唯一内容，用 index 保证 key 唯一
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${item.name}-${index}`}
                  className="rounded-full border px-2 py-1"
                  style={{
                    fontSize: font.smallSize,
                    color: theme.textPrimary,
                    borderColor: theme.primaryColor,
                  }}
                >
                  {item.name}
                </span>
              ))}
            </div>
          )
        : null}
    </RuntimeSection>
  )
}
