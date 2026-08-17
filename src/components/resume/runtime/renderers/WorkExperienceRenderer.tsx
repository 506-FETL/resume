import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { rangeHasValue } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function WorkExperienceRenderer() {
  const { work_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('work_experience')) {
    return null
  }

  const items = work_experience.items.filter(item =>
    !item.hidden
    && (item.companyName || item.position || item.workInfo || rangeHasValue(item.workDuration)))

  return (
    <RuntimeSection title="工作经历">
      {items.map(item => (
        <RuntimeEntry
          key={item.entryId}
          sectionKey="work_experience"
          entryId={item.entryId}
          titleFieldKey="companyName"
          titleFieldLabel="公司名称"
          subtitleFieldKey="position"
          subtitleFieldLabel="职位"
          contentFieldLabel="工作经历描述"
          contentHtml={item.workInfo}
        />
      ))}
    </RuntimeSection>
  )
}
