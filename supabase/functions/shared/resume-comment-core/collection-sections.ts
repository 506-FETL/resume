import type { ProjectedNodeInput } from './types.ts'
import { projectExperienceCollection } from './experience-sections.ts'
import {
  readRecord,
  readString,
  pushRichTextNode,
  readArray,
  buildEntryId,
  pushTextNode,
} from './projection-values.ts'

export function projectCollectionSections(
  resume: Record<string, unknown>,
  sections: Record<string, ProjectedNodeInput[]>,
) {
  projectExperienceCollection(
    sections.edu_background,
    'edu_background',
    'items',
    readRecord(resume.edu_background).items,
    {
      title: 'schoolName',
      titleFallback: '学校',
      subtitle: 'professionalDegree',
      subtitleProject: (entry) =>
        [
          readString(entry.professional),
          entry.degree !== '不填' ? readString(entry.degree) : '',
        ]
          .filter(Boolean)
          .join(' / '),
      duration: 'duration',
      content: 'eduInfo',
      visibilityFields: ['schoolName', 'professional', 'eduInfo'],
    },
  )

  projectExperienceCollection(
    sections.work_experience,
    'work_experience',
    'items',
    readRecord(resume.work_experience).items,
    {
      title: 'companyName',
      titleFallback: '公司',
      subtitle: 'position',
      duration: 'workDuration',
      content: 'workInfo',
    },
  )

  projectExperienceCollection(
    sections.internship_experience,
    'internship_experience',
    'items',
    readRecord(resume.internship_experience).items,
    {
      title: 'companyName',
      titleFallback: '公司',
      subtitle: 'position',
      duration: 'internshipDuration',
      content: 'internshipInfo',
    },
  )

  projectExperienceCollection(
    sections.campus_experience,
    'campus_experience',
    'items',
    readRecord(resume.campus_experience).items,
    {
      title: 'experienceName',
      titleFallback: '校园经历',
      subtitle: 'role',
      duration: 'duration',
      content: 'campusInfo',
    },
  )

  projectExperienceCollection(
    sections.project_experience,
    'project_experience',
    'items',
    readRecord(resume.project_experience).items,
    {
      title: 'projectName',
      titleFallback: '项目',
      subtitle: 'participantRole',
      duration: 'projectDuration',
      content: 'projectInfo',
    },
  )

  const skillSection = readRecord(resume.skill_specialty)

  pushRichTextNode(
    sections.skill_specialty,
    'skill_specialty',
    'singleton',
    'description',
    skillSection.description,
  )

  const usedSkillIds = new Set<string>()

  readArray(skillSection.skills).forEach((value, index) => {
    const entry = readRecord(value)

    if (entry.hidden === true) {
      return
    }

    const entryId = buildEntryId(
      'skill_specialty',
      'skills',
      index,
      entry,
      usedSkillIds,
    )

    const label = readString(entry.label).trim()
    const proficiency = readString(entry.proficiencyLevel).trim()

    pushTextNode(
      sections.skill_specialty,
      'skill_specialty',
      entryId,
      'skill',
      `${label} · ${proficiency}`.trim(),
    )
  })

  const certificateSection = readRecord(resume.honors_certificates)

  pushRichTextNode(
    sections.honors_certificates,
    'honors_certificates',
    'singleton',
    'description',
    certificateSection.description,
  )

  const usedCertificateIds = new Set<string>()

  readArray(certificateSection.certificates).forEach((value, index) => {
    const entry = readRecord(value)

    if (entry.hidden === true) {
      return
    }

    pushTextNode(
      sections.honors_certificates,
      'honors_certificates',
      buildEntryId(
        'honors_certificates',
        'certificates',
        index,
        entry,
        usedCertificateIds,
      ),
      'name',
      entry.name,
    )
  })

  const hobbySection = readRecord(resume.hobbies)

  pushRichTextNode(
    sections.hobbies,
    'hobbies',
    'singleton',
    'description',
    hobbySection.description,
  )

  const usedHobbyIds = new Set<string>()

  readArray(hobbySection.hobbies).forEach((value, index) => {
    const entry = readRecord(value)

    if (entry.hidden === true) {
      return
    }

    pushTextNode(
      sections.hobbies,
      'hobbies',
      buildEntryId('hobbies', 'hobbies', index, entry, usedHobbyIds),
      'name',
      entry.name,
    )
  })
}
