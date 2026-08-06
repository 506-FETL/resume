import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { formatRange, rangeHasValue, rangeKey } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function EducationRenderer() {
  const { edu_background, getVisibility } = useTemplateResumeData()

  if (!getVisibility('edu_background')) {
    return null
  }

  const items = edu_background.items.filter(item =>
    item.schoolName || item.professional || item.eduInfo || rangeHasValue(item.duration))

  return (
    <RuntimeSection title="教育经历">
      {items.map((item, index) => (
        <RuntimeEntry
          // 空/重复条目无稳定唯一内容，用 index 保证 key 唯一
          // eslint-disable-next-line react/no-array-index-key
          key={`${item.schoolName}-${item.professional}-${rangeKey(item.duration)}-${index}`}
          title={item.schoolName || '学校'}
          subtitle={[item.professional, item.degree !== '不填' ? item.degree : ''].filter(Boolean).join(' / ')}
          duration={formatRange(item.duration)}
          content={item.eduInfo}
        />
      ))}
    </RuntimeSection>
  )
}
