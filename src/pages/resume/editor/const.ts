import type { Item } from './types'
import type { ORDERType } from '@/lib/schema'
import {
  Award,
  Briefcase,
  Building2,
  Code2,
  GraduationCap,
  Heart,
  Lightbulb,
  MessageSquare,
  School,
  Trophy,
  UserCheck,
  UserRound,
} from 'lucide-react'
import { createElement } from 'react'
import ApplicationInfoForm from './components/forms/application-info'
import BasicResumeForm from './components/forms/basic-resume'
import CampusExperienceForm from './components/forms/campus-experience'
import EduBackgroundForm from './components/forms/edu-background'
import HobbiesForm from './components/forms/hobbies'
import HonorsCertificatesForm from './components/forms/honors-certificates'
import InternshipExperienceForm from './components/forms/internship-experience'
import JobIntentForm from './components/forms/job-intent'
import ProjectExperienceForm from './components/forms/project-experience'
import SelfEvaluationForm from './components/forms/self-evaluation'
import SkillSpecialtyForm from './components/forms/skill-specialty'
import WorkExperienceForm from './components/forms/work-experience'

export const ITEMS: Item<ORDERType>[] = [
  {
    id: 'basics',
    label: '基本信息',
    icon: createElement(UserRound),
    content: createElement(BasicResumeForm),
  },
  {
    id: 'job_intent',
    label: '求职意向',
    icon: createElement(Briefcase),
    content: createElement(JobIntentForm),
  },
  {
    id: 'application_info',
    label: '报考信息',
    icon: createElement(School),
    content: createElement(ApplicationInfoForm),
  },
  {
    id: 'edu_background',
    label: '教育背景',
    icon: createElement(GraduationCap),
    content: createElement(EduBackgroundForm),
  },
  {
    id: 'work_experience',
    label: '工作经历',
    icon: createElement(Building2),
    content: createElement(WorkExperienceForm),
  },
  {
    id: 'internship_experience',
    label: '实习经验',
    icon: createElement(UserCheck),
    content: createElement(InternshipExperienceForm),
  },
  {
    id: 'campus_experience',
    label: '校园经历',
    icon: createElement(Trophy),
    content: createElement(CampusExperienceForm),
  },
  {
    id: 'project_experience',
    label: '项目经验',
    icon: createElement(Code2),
    content: createElement(ProjectExperienceForm),
  },
  {
    id: 'skill_specialty',
    label: '技能特长',
    icon: createElement(Lightbulb),
    content: createElement(SkillSpecialtyForm),
  },
  {
    id: 'honors_certificates',
    label: '荣誉证书',
    icon: createElement(Award),
    content: createElement(HonorsCertificatesForm),
  },
  {
    id: 'self_evaluation',
    label: '自我评价',
    icon: createElement(MessageSquare),
    content: createElement(SelfEvaluationForm),
  },
  {
    id: 'hobbies',
    label: '兴趣爱好',
    icon: createElement(Heart),
    content: createElement(HobbiesForm),
  },
]
