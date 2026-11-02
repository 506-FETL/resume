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
import { createDeferredComponent } from '@/components/deferred-content'

const ApplicationInfoForm = createDeferredComponent(
  () => import('./components/forms/application-info'),
  '报考信息',
)

const BasicResumeForm = createDeferredComponent(
  () => import('./components/forms/basic-resume'),
  '基本信息',
)

const CampusExperienceForm = createDeferredComponent(
  () => import('./components/forms/campus-experience'),
  '校园经历',
)

const EduBackgroundForm = createDeferredComponent(
  () => import('./components/forms/edu-background'),
  '教育背景',
)

const HobbiesForm = createDeferredComponent(
  () => import('./components/forms/hobbies'),
  '兴趣爱好',
)

const HonorsCertificatesForm = createDeferredComponent(
  () => import('./components/forms/honors-certificates'),
  '荣誉证书',
)

const InternshipExperienceForm = createDeferredComponent(
  () => import('./components/forms/internship-experience'),
  '实习经验',
)

const JobIntentForm = createDeferredComponent(
  () => import('./components/forms/job-intent'),
  '求职意向',
)

const ProjectExperienceForm = createDeferredComponent(
  () => import('./components/forms/project-experience'),
  '项目经验',
)

const SelfEvaluationForm = createDeferredComponent(
  () => import('./components/forms/self-evaluation'),
  '自我评价',
)

const SkillSpecialtyForm = createDeferredComponent(
  () => import('./components/forms/skill-specialty'),
  '技能特长',
)

const WorkExperienceForm = createDeferredComponent(
  () => import('./components/forms/work-experience'),
  '工作经历',
)

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
