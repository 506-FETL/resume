import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { formatRange, rangeHasValue, rangeKey } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function WorkExperienceRenderer() {
  const { work_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('work_experience')) {
    return null
  }

  const items = work_experience.items.filter(item =>
    item.companyName || item.position || item.workInfo || rangeHasValue(item.workDuration))

  return (
    <RuntimeSection title="工作经历">
      {items.map((item, index) => (
        <RuntimeEntry
          // 空/重复条目无稳定唯一内容，用 index 保证 key 唯一
          // eslint-disable-next-line react/no-array-index-key
          key={`${item.companyName}-${item.position}-${rangeKey(item.workDuration)}-${index}`}
          title={item.companyName || '公司'}
          subtitle={item.position}
          duration={formatRange(item.workDuration)}
          content={item.workInfo}
        />
      ))}
    </RuntimeSection>
  )
}
