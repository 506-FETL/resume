import { useTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { rangeHasValue } from './duration'
import { RuntimeEntry, RuntimeSection } from './shared'

export default function EducationRenderer() {
  const { edu_background, getVisibility } = useTemplateResumeData()

  if (!getVisibility('edu_background')) {
    return null
  }

  const items = edu_background.items.filter(item =>
    !item.hidden
    && (item.schoolName || item.professional || item.eduInfo || rangeHasValue(item.duration)))

  return (
    <RuntimeSection title="教育经历">
      {items.map(item => (
        <RuntimeEntry
          key={item.entryId}
          sectionKey="edu_background"
          entryId={item.entryId}
          titleFieldKey="schoolName"
          titleFieldLabel="学校名称"
          subtitleFieldKey="professionalDegree"
          subtitleFieldLabel="专业与学历"
          contentFieldLabel="教育经历描述"
          contentHtml={item.eduInfo}
        />
      ))}
    </RuntimeSection>
  )
}
