import type React from 'react'
import type { ResumeContextType, ResumeFont, ResumeSpacing, ResumeTheme } from '../resume-context'
import type { ORDERType, ProficiencyLevel, ResumeSchema } from '@/lib/schema'
import parser from 'html-react-parser'
import { BookOpen, Briefcase, GraduationCap, Medal, Rocket, Sparkles, Target, Trophy, Users } from 'lucide-react'
import { createContext, use, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import useAge from '@/hooks/useAge'
import useResumeStore from '@/store/resume/form'

// 创建简历上下文
const ResumeContext = createContext<ResumeContextType | null>(null)

function useResumeContext() {
  const context = use(ResumeContext)
  if (!context) {
    throw new Error('useResumeContext 必须在 ResumeProvider 内部使用')
  }
  return context
}

interface ResumeProviderProps {
  theme: ResumeTheme
  spacing: ResumeSpacing
  font: ResumeFont
  children: React.ReactNode
}

function ResumeProvider({ children, theme, spacing, font }: ResumeProviderProps) {
  const contextValue = useMemo(() => ({ theme, spacing, font }), [theme, spacing, font])

  return (
    <ResumeContext value={contextValue}>
      {children}
    </ResumeContext>
  )
}

const skillProficiencyMap: Record<ProficiencyLevel, number> = {
  一般: 50,
  良好: 65,
  熟练: 80,
  擅长: 85,
  精通: 95,
}

function formatDuration(duration?: string[]): string | undefined {
  return duration?.[0] ? `${duration[0]} - ${duration[1] || '至今'}` : undefined
}

function Section({ title, children, icon }: { title: string, children: React.ReactNode, icon?: React.ReactNode }) {
  const { theme, font, spacing } = useResumeContext()
  return (
    <section style={{ marginBottom: spacing.sectionMargin }}>
      <div
        className="flex items-center gap-3 mb-4 pb-2 border-b-2"
        style={{
          marginBottom: spacing.sectionTitleMargin,
          borderColor: theme.primaryColor,
        }}
      >
        {icon && (
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full text-white"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {icon}
          </div>
        )}
        <h2
          className="m-0 flex-1"
          style={{
            fontSize: font.sectionTitleSize,
            fontWeight: font.boldWeight,
            color: theme.textPrimary,
          }}
        >
          {title}
        </h2>
      </div>
      <div className="flex flex-col" style={{ gap: spacing.itemSpacing }}>
        {children}
      </div>
    </section>
  )
}

function Entry({ title, subtitle, duration, content }: {
  title: string
  subtitle?: string
  duration?: string
  content?: string
}) {
  const { theme, font, spacing } = useResumeContext()
  return (
    <div
      className="relative pl-6"
      style={{
        padding: spacing.itemSpacing,
        paddingLeft: '1.5rem',
      }}
    >
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="flex flex-col gap-1 flex-1">
          <h3
            className="m-0"
            style={{
              fontSize: font.contentSize,
              fontWeight: font.boldWeight,
              color: theme.textPrimary,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <span
              style={{
                fontSize: font.contentSize,
                fontWeight: font.mediumWeight,
                color: theme.textSecondary,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
        {duration && (
          <div
            className="flex items-center whitespace-nowrap text-sm"
            style={{ fontSize: font.smallSize, color: theme.textMuted }}
          >
            {duration}
          </div>
        )}
      </div>
      {content && (
        <div className="prose mt-2" style={{ marginTop: `calc(${spacing.itemSpacing} / 2)` }}>
          {parser(content)}
        </div>
      )}
    </div>
  )
}

function BasicsModule({ data, age }: { data: ResumeSchema, age?: string | number }) {
  const { theme, font, spacing } = useResumeContext()
  const { basics, jobIntent } = data
  const infoFields = [
    age && { icon: '年龄', value: `${age}岁` },
    basics.gender !== '不填' && { icon: '性别', value: basics.gender },
    basics.nation && { icon: '籍贯', value: basics.nation },
    basics.workYears && { icon: '工作年限', value: basics.workYears },
    basics.phone && { icon: '电话', value: basics.phone },
    basics.email && { icon: '邮箱', value: basics.email },
  ].filter(Boolean) as Array<{ icon: string, value: string }>

  return (
    <header
      className="relative text-white mb-6"
      style={{
        background: theme.primaryColor,
        marginBottom: spacing.sectionMargin,
        padding: '2rem 2.5rem',
      }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1
            className="m-0 mb-4"
            style={{
              fontSize: font.nameSize,
              fontWeight: font.boldWeight,
            }}
          >
            {basics.name || '姓名'}
          </h1>

          {jobIntent && (
            <div
              className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-white/30"
              style={{ fontSize: font.jobIntentSize, fontWeight: font.mediumWeight }}
            >
              <div className="flex items-center gap-2">
                <span>求职意向:</span>
                <span>{jobIntent.jobIntent}</span>
              </div>
              {jobIntent.intentionalCity && (
                <>
                  <span>|</span>
                  <span>{jobIntent.intentionalCity}</span>
                </>
              )}
              {jobIntent.expectedSalary && (
                <>
                  <span>|</span>
                  <span>
                    {jobIntent.expectedSalary}
                    /月
                  </span>
                </>
              )}
              {jobIntent.dateEntry && jobIntent.dateEntry !== '不填' && (
                <>
                  <span>|</span>
                  <span>{jobIntent.dateEntry}</span>
                </>
              )}
            </div>
          )}

          <div
            className="grid gap-x-8 gap-y-2"
            style={{
              fontSize: font.contentSize,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            {infoFields.map(field => (
              <div key={field.icon} className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="opacity-90">{field.icon}</span>
                  <span>:</span>
                </span>
                <span>{field.value}</span>
              </div>
            ))}
          </div>

          {basics.customFields?.filter(f => f?.label && f?.value).map(field => (
            field && (
              <div
                key={field.label}
                className="mt-2"
                style={{ fontSize: font.contentSize }}
              >
                <span className="opacity-90">
                  {field.label}
                  ：
                </span>
                <span>{field.value}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </header>
  )
}

function ApplicationInfoModule() {
  const { theme, font, spacing } = useResumeContext()
  const { applicationInfo } = useResumeStore()

  return (
    <Section title="报考信息" icon={<Target size={20} />}>
      <div className="modern-card" style={{ padding: spacing.itemSpacing }}>
        {applicationInfo.applicationSchool && (
          <div className="modern-info-row" style={{ fontSize: font.contentSize, lineHeight: spacing.lineHeight }}>
            <span className="modern-info-label" style={{ color: theme.textSecondary }}>报考院校：</span>
            <span style={{ fontWeight: font.mediumWeight, color: theme.textPrimary }}>{applicationInfo.applicationSchool}</span>
          </div>
        )}
        {applicationInfo.applicationMajor && (
          <div className="modern-info-row" style={{ fontSize: font.contentSize, lineHeight: spacing.lineHeight }}>
            <span className="modern-info-label" style={{ color: theme.textSecondary }}>报考专业：</span>
            <span style={{ fontWeight: font.mediumWeight, color: theme.textPrimary }}>{applicationInfo.applicationMajor}</span>
          </div>
        )}
      </div>
    </Section>
  )
}

function EduBackgroundModule() {
  const { eduBackground } = useResumeStore()
  return (
    <Section title="教育背景" icon={<GraduationCap size={20} />}>
      {eduBackground.items.map(item => (
        <Entry
          key={`${item.schoolName}-${item.professional}`}
          title={item.schoolName}
          subtitle={item.degree !== '不填' ? `${item.professional}（${item.degree}）` : item.professional}
          duration={formatDuration(item.duration)}
          content={item.eduInfo}
        />
      ))}
    </Section>
  )
}

function WorkExperienceModule() {
  const { workExperience } = useResumeStore()
  return (
    <Section title="工作经历" icon={<Briefcase size={20} />}>
      {workExperience.items.map(item => (
        <Entry
          key={`${item.companyName}-${item.position}`}
          title={item.companyName}
          subtitle={item.position}
          duration={formatDuration(item.workDuration)}
          content={item.workInfo}
        />
      ))}
    </Section>
  )
}

function InternshipExperienceModule() {
  const { internshipExperience } = useResumeStore()
  return (
    <Section title="实习经验" icon={<Rocket size={20} />}>
      {internshipExperience.items.map(item => (
        <Entry
          key={`${item.companyName}-${item.position}`}
          title={item.companyName}
          subtitle={item.position}
          duration={formatDuration(item.internshipDuration)}
          content={item.internshipInfo}
        />
      ))}
    </Section>
  )
}

function ProjectExperienceModule() {
  const { projectExperience } = useResumeStore()
  return (
    <Section title="项目经验" icon={<BookOpen size={20} />}>
      {projectExperience.items.map(item => (
        <Entry
          key={`${item.projectName}-${item.participantRole}`}
          title={item.projectName}
          subtitle={item.participantRole}
          duration={formatDuration(item.projectDuration)}
          content={item.projectInfo}
        />
      ))}
    </Section>
  )
}

function CampusExperienceModule() {
  const { campusExperience } = useResumeStore()
  return (
    <Section title="校园经历" icon={<Users size={20} />}>
      {campusExperience.items.map(item => (
        <Entry
          key={`${item.experienceName}-${item.role}`}
          title={item.experienceName}
          subtitle={item.role}
          duration={formatDuration(item.duration)}
          content={item.campusInfo}
        />
      ))}
    </Section>
  )
}

function SkillSpecialtyModule() {
  const { theme, font, spacing } = useResumeContext()
  const { skillSpecialty } = useResumeStore()

  return (
    <Section title="技能特长" icon={<Medal size={20} />}>
      {skillSpecialty.description && (
        <div className="prose" style={{ padding: spacing.itemSpacing }}>
          {parser(skillSpecialty.description)}
        </div>
      )}
      {skillSpecialty.skills?.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {skillSpecialty.skills.map((skill) => {
            const percentage = skillProficiencyMap[skill.proficiencyLevel] || 50
            return (
              <div key={skill.label} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: font.contentSize, color: theme.textPrimary, fontWeight: font.mediumWeight }}>
                    {skill.label}
                  </span>
                  <span style={{ fontSize: font.smallSize, color: theme.textMuted }}>
                    {skill.proficiencyLevel}
                  </span>
                </div>
                {skill.displayType === 'percentage' && (
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: theme.progressBarBg }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: theme.primaryColor,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function HonorsCertificatesModule() {
  const { theme, font, spacing } = useResumeContext()
  const { honorsCertificates } = useResumeStore()

  return (
    <Section title="荣誉证书" icon={<Trophy size={20} />}>
      {honorsCertificates.description && (
        <div className="prose" style={{ padding: spacing.itemSpacing }}>
          {parser(honorsCertificates.description)}
        </div>
      )}
      {honorsCertificates.certificates?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {honorsCertificates.certificates.map(cert => (
            <Badge
              key={cert.name}
              variant="outline"
              style={{
                fontSize: font.contentSize,
                borderColor: theme.primaryColor,
                color: theme.textPrimary,
              }}
            >
              {cert.name}
            </Badge>
          ))}
        </div>
      )}
    </Section>
  )
}

function SelfEvaluationModule() {
  const { spacing } = useResumeContext()
  const { selfEvaluation } = useResumeStore()
  return (
    <Section title="自我评价" icon={<Sparkles size={20} />}>
      <div className="prose" style={{ padding: spacing.itemSpacing }}>
        {parser(selfEvaluation.content)}
      </div>
    </Section>
  )
}

function HobbiesModule() {
  const { theme, font } = useResumeContext()
  const { hobbies } = useResumeStore()

  return (
    <Section title="兴趣爱好" icon={<Sparkles size={20} />}>
      {hobbies.description && (
        <div className="prose mb-3">
          {parser(hobbies.description)}
        </div>
      )}
      {hobbies.hobbies?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hobbies.hobbies.map(hobby => (
            <Badge
              variant="outline"
              key={hobby.name}
              style={{
                fontSize: font.contentSize,
                borderColor: theme.primaryColor,
                color: theme.textPrimary,
              }}
            >
              {hobby.name}
            </Badge>
          ))}
        </div>
      )}
    </Section>
  )
}

const MODULE_COMPONENTS: Record<ORDERType, React.ComponentType<any>> = {
  basics: BasicsModule,
  applicationInfo: ApplicationInfoModule,
  eduBackground: EduBackgroundModule,
  workExperience: WorkExperienceModule,
  internshipExperience: InternshipExperienceModule,
  projectExperience: ProjectExperienceModule,
  campusExperience: CampusExperienceModule,
  skillSpecialty: SkillSpecialtyModule,
  honorsCertificates: HonorsCertificatesModule,
  selfEvaluation: SelfEvaluationModule,
  hobbies: HobbiesModule,
  jobIntent: () => null,
} as const

interface ModernResumeContentProps {
  theme: ResumeTheme
  spacing: ResumeSpacing
  font: ResumeFont
}

export default function ModernResume({ theme, spacing, font }: ModernResumeContentProps) {
  const data = useResumeStore()
  const getVisibility = useResumeStore(state => state.getVisibility)
  const age = useAge(data.basics.birthMonth)

  return (
    <ResumeProvider theme={theme} spacing={spacing} font={font}>
      <div className="modern-resume" style={{ fontFamily: font.fontFamily }}>
        {data.order.map((moduleType: ORDERType) => {
          const Component = MODULE_COMPONENTS[moduleType]
          if (!Component || (moduleType !== 'basics' && getVisibility(moduleType)))
            return null

          if (moduleType === 'basics') {
            return <BasicsModule key={moduleType} data={data} age={age} />
          }

          return <Component key={moduleType} />
        })}
      </div>
    </ResumeProvider>
  )
}
