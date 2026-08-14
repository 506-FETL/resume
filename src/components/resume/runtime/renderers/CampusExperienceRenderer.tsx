import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { rangeHasValue } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function CampusExperienceRenderer() {
  const { campus_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('campus_experience')) {
    return null
  }

  const items = campus_experience.items.filter(item =>
    item.experienceName || item.role || item.campusInfo || rangeHasValue(item.duration))

  return (
    <RuntimeSection title="校园经历">
      {items.map(item => (
        <RuntimeEntry
          key={item.entryId}
          sectionKey="campus_experience"
          entryId={item.entryId}
          titleFieldKey="experienceName"
          titleFieldLabel="经历名称"
          subtitleFieldKey="role"
          subtitleFieldLabel="担任角色"
          contentFieldLabel="校园经历描述"
          contentHtml={item.campusInfo}
        />
      ))}
    </RuntimeSection>
  )
}
