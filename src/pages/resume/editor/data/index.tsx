import type { ReactNode } from 'react'
import type { ORDERType } from '@/lib/schema'
import { Award, Briefcase, Building2, Code2, GraduationCap, Heart, Lightbulb, MessageSquare, School, Trophy, UserCheck, UserRound } from 'lucide-react'
import ApplicationInfoForm from '../components/forms/ApplicationInfoForm'
import BasicResumeForm from '../components/forms/BasicResumeForm'
import CampusExperienceForm from '../components/forms/CampusExperienceForm'
import EduBackgroundForm from '../components/forms/EduBackgroundForm'
import HobbiesForm from '../components/forms/HobbiesForm'
import HonorsCertificatesForm from '../components/forms/HonorsCertificatesForm'
import InternshipExperienceForm from '../components/forms/InternshipExperienceForm'
import JobIntentForm from '../components/forms/JobIntentForm'
import ProjectExperienceForm from '../components/forms/ProjectExperienceForm'
import SelfEvaluationForm from '../components/forms/SelfEvaluationForm'
import SkillSpecialtyForm from '../components/forms/SkillSpecialtyForm'
import WorkExperienceForm from '../components/forms/WorkExperienceForm'

export interface Item<T> {
  id: T
  label: string
  icon: ReactNode
  content: ReactNode
}

export const ITEMS: Item<ORDERType>[] = [
  {
    id: 'basics',
    label: '基本信息',
    icon: <UserRound />,
    content: <BasicResumeForm />,
  },
  {
    id: 'jobIntent',
    label: '求职意向',
    icon: <Briefcase />,
    content: <JobIntentForm />,
  },
  {
    id: 'applicationInfo',
    label: '报考信息',
    icon: <School />,
    content: <ApplicationInfoForm />,
  },
  {
    id: 'eduBackground',
    label: '教育背景',
    icon: <GraduationCap />,
    content: <EduBackgroundForm />,
  },
  {
    id: 'workExperience',
    label: '工作经历',
    icon: <Building2 />,
    content: <WorkExperienceForm />,
  },
  {
    id: 'internshipExperience',
    label: '实习经验',
    icon: <UserCheck />,
    content: <InternshipExperienceForm />,
  },
  {
    id: 'campusExperience',
    label: '校园经历',
    icon: <Trophy />,
    content: <CampusExperienceForm />,
  },
  {
    id: 'projectExperience',
    label: '项目经验',
    icon: <Code2 />,
    content: <ProjectExperienceForm />,
  },
  {
    id: 'skillSpecialty',
    label: '技能特长',
    icon: <Lightbulb />,
    content: <SkillSpecialtyForm />,
  },
  {
    id: 'honorsCertificates',
    label: '荣誉证书',
    icon: <Award />,
    content: <HonorsCertificatesForm />,
  },
  {
    id: 'selfEvaluation',
    label: '自我评价',
    icon: <MessageSquare />,
    content: <SelfEvaluationForm />,
  },
  {
    id: 'hobbies',
    label: '兴趣爱好',
    icon: <Heart />,
    content: <HobbiesForm />,
  },
]
