import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { formatRange, rangeHasValue, rangeKey } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function ProjectExperienceRenderer() {
  const { project_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('project_experience')) {
    return null
  }

  const items = project_experience.items.filter(item =>
    item.projectName || item.participantRole || item.projectInfo || rangeHasValue(item.projectDuration))

  return (
    <RuntimeSection title="项目经历">
      {items.map((item, index) => (
        <RuntimeEntry
          // 空/重复条目无稳定唯一内容，用 index 保证 key 唯一
          // eslint-disable-next-line react/no-array-index-key
          key={`${item.projectName}-${item.participantRole}-${rangeKey(item.projectDuration)}-${index}`}
          title={item.projectName || '项目'}
          subtitle={item.participantRole}
          duration={formatRange(item.projectDuration)}
          content={item.projectInfo}
        />
      ))}
    </RuntimeSection>
  )
}
