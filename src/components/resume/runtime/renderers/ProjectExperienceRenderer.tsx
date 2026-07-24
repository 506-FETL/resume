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
      {items.map(item => (
        <RuntimeEntry
          key={`${item.projectName}-${item.participantRole}-${rangeKey(item.projectDuration)}`}
          title={item.projectName || '项目'}
          subtitle={item.participantRole}
          duration={formatRange(item.projectDuration)}
          content={item.projectInfo}
        />
      ))}
    </RuntimeSection>
  )
}
