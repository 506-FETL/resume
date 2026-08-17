import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { rangeHasValue } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function ProjectExperienceRenderer() {
  const { project_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('project_experience')) {
    return null
  }

  const items = project_experience.items.filter(item =>
    !item.hidden
    && (item.projectName || item.participantRole || item.projectInfo || rangeHasValue(item.projectDuration)))

  return (
    <RuntimeSection title="项目经历">
      {items.map(item => (
        <RuntimeEntry
          key={item.entryId}
          sectionKey="project_experience"
          entryId={item.entryId}
          titleFieldKey="projectName"
          titleFieldLabel="项目名称"
          subtitleFieldKey="participantRole"
          subtitleFieldLabel="项目角色"
          contentFieldLabel="项目经历描述"
          contentHtml={item.projectInfo}
        />
      ))}
    </RuntimeSection>
  )
}
