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
      {items.map(item => (
        <RuntimeEntry
          key={`${item.schoolName}-${item.professional}-${rangeKey(item.duration)}`}
          title={item.schoolName || '学校'}
          subtitle={[item.professional, item.degree !== '不填' ? item.degree : ''].filter(Boolean).join(' / ')}
          duration={formatRange(item.duration)}
          content={item.eduInfo}
        />
      ))}
    </RuntimeSection>
  )
}
