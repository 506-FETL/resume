import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { RuntimeRichText, RuntimeSection } from './shared'
import { useRuntimeStyles } from './utils'

export default function HobbiesRenderer() {
  const { hobbies, getVisibility } = useTemplateResumeData()
  const { font, theme } = useRuntimeStyles()

  if (!getVisibility('hobbies')) {
    return null
  }

  return (
    <RuntimeSection title="兴趣爱好">
      {hobbies.description ? <RuntimeRichText html={hobbies.description} /> : null}
      {hobbies.hobbies.length > 0
        ? (
            <div className="flex flex-wrap gap-2">
              {hobbies.hobbies.map((item, index) => (
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
