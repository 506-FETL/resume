import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { rangeHasValue } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function InternshipExperienceRenderer() {
  const { internship_experience, getVisibility } = useTemplateResumeData()

  if (!getVisibility('internship_experience')) {
    return null
  }

  const items = internship_experience.items.filter(item =>
    !item.hidden
    && (item.companyName || item.position || item.internshipInfo || rangeHasValue(item.internshipDuration)))

  return (
    <RuntimeSection title="实习经历" sectionKey="internship_experience">
      {items.map(item => (
        <RuntimeEntry
          key={item.entryId}
          sectionKey="internship_experience"
          entryId={item.entryId}
          titleFieldKey="companyName"
          titleFieldLabel="公司名称"
          subtitleFieldKey="position"
          subtitleFieldLabel="实习职位"
          contentFieldLabel="实习经历描述"
          contentHtml={item.internshipInfo}
        />
      ))}
    </RuntimeSection>
  )
}
