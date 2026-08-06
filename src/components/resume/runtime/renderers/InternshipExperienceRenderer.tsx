import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { formatRange, rangeHasValue, rangeKey } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function InternshipExperienceRenderer() {
  const { internship_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('internship_experience')) {
    return null
  }

  const items = internship_experience.items.filter(item =>
    item.companyName || item.position || item.internshipInfo || rangeHasValue(item.internshipDuration))

  return (
    <RuntimeSection title="实习经历">
      {items.map((item, index) => (
        <RuntimeEntry
          // 空/重复条目无稳定唯一内容，用 index 保证 key 唯一
          // eslint-disable-next-line react/no-array-index-key
          key={`${item.companyName}-${item.position}-${rangeKey(item.internshipDuration)}-${index}`}
          title={item.companyName || '公司'}
          subtitle={item.position}
          duration={formatRange(item.internshipDuration)}
          content={item.internshipInfo}
        />
      ))}
    </RuntimeSection>
  )
}
