import type React from 'react'
import type { ResumeContextType, ResumeFont, ResumeSpacing, ResumeTheme } from '../resume-context'
import type { ORDERType, ProficiencyLevel, ResumeSchema } from '@/lib/schema'
import parser from 'html-react-parser'
import { createContext, use, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import useAge from '@/hooks/useAge'
import useResumeStore from '@/store/resume/form'
import './basic.css'

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

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  const { theme, font, spacing } = useResumeContext()
  return (
    <section style={{ marginBottom: spacing.sectionMargin }}>
      <h2
        className="m-0 border-b-2"
        style={{
          fontSize: font.sectionTitleSize,
          fontWeight: font.boldWeight,
          color: theme.primaryColor,
          marginBottom: spacing.sectionTitleMargin,
          paddingBottom: `calc(${spacing.itemSpacing} / 2)`,
          borderColor: theme.primaryColor,
        }}
      >
        {title}
      </h2>
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
  const { theme, font } = useResumeContext()
  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-2">
        <div className="flex items-baseline gap-3 flex-1">
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
          <div className="whitespace-nowrap" style={{ fontSize: font.smallSize, color: theme.textMuted }}>
            {duration}
          </div>
        )}
      </div>
      {content && <div className="prose">{parser(content)}</div>}
    </div>
  )
}

function BasicsModule({ data, age }: { data: ResumeSchema, age?: string | number }) {
  const { theme, font, spacing } = useResumeContext()
  const { basics, jobIntent } = data
  const infoFields = [
    age && `${age}岁`,
    basics.gender !== '不填' && basics.gender,
    basics.nation,
    basics.heightCm && `${basics.heightCm}cm`,
    basics.weightKg && `${basics.weightKg}kg`,
    basics.maritalStatus !== '不填' && basics.maritalStatus,
  ].filter(Boolean)

  return (
    <header
      className="flex flex-col items-center"
      style={{
        borderColor: theme.primaryColor,
        marginBottom: spacing.sectionMargin,
        paddingBottom: spacing.itemSpacing,
      }}
    >
      <h1
        className="text-center m-0"
        style={{
          fontSize: font.nameSize,
          fontWeight: font.boldWeight,
          color: theme.primaryColor,
          marginBottom: '0.5em',
        }}
      >
        {basics.name || '姓名'}
      </h1>

      {jobIntent && (
        <div
          style={{
            fontSize: font.jobIntentSize,
            color: theme.textSecondary,
            marginBottom: '0.5em',
            fontWeight: font.mediumWeight,
          }}
        >
          求职意向：
          {jobIntent.jobIntent}
          {jobIntent.intentionalCity && ` | ${jobIntent.intentionalCity}`}
          {jobIntent.expectedSalary && ` | ${jobIntent.expectedSalary}K`}
          {jobIntent.dateEntry && jobIntent.dateEntry !== '不填' && ` | ${jobIntent.dateEntry}`}
        </div>
      )}

      {infoFields.length > 0 && (
        <div
          className="flex flex-wrap justify-center"
          style={{
            gap: spacing.itemSpacing,
            fontSize: font.contentSize,
            color: theme.textPrimary,
            marginBottom: `calc(${spacing.itemSpacing} / 2)`,
          }}
        >
          {infoFields.map((field, i) => (
            <span key={i}>
              {field}
              {i < infoFields.length - 1 && <span style={{ color: theme.textMuted }}> | </span>}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap justify-center"
        style={{
          gap: spacing.itemSpacing,
          fontSize: font.contentSize,
          color: theme.textPrimary,
        }}
      >
        {basics.phone && <span>{basics.phone}</span>}
        {basics.phone && basics.email && <span style={{ color: theme.textMuted }}> | </span>}
        {basics.email && <span>{basics.email}</span>}
      </div>

      {basics.customFields?.filter(f => f?.label && f?.value).map((field, i) => (
        field && (
          <div
            key={`custom-field-${i}`}
            style={{
              fontSize: font.contentSize,
              color: theme.textPrimary,
              marginTop: '0.5em',
            }}
          >
            <span style={{ fontWeight: font.mediumWeight }}>
              {field.label}
              ：
            </span>
            <span>{field.value}</span>
          </div>
        )
      ))}
    </header>
  )
}

function ApplicationInfoModule() {
  const { font, spacing } = useResumeContext()
  const { applicationInfo } = useResumeStore()

  return (
    <Section title="报考信息">
      {applicationInfo.applicationSchool && (
        <div style={{ fontSize: font.contentSize, lineHeight: spacing.lineHeight }}>
          报考院校：
          <span style={{ fontWeight: font.mediumWeight }}>{applicationInfo.applicationSchool}</span>
        </div>
      )}
      {applicationInfo.applicationMajor && (
        <div style={{ fontSize: font.contentSize, lineHeight: spacing.lineHeight }}>
          报考专业：
          <span style={{ fontWeight: font.mediumWeight }}>{applicationInfo.applicationMajor}</span>
        </div>
      )}
    </Section>
  )
}

function EduBackgroundModule() {
  const { eduBackground } = useResumeStore()
  return (
    <Section title="教育背景">
      {eduBackground.items.map((item, i) => (
        <Entry
          key={`edu-${item.schoolName}-${i}`}
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
    <Section title="工作经历">
      {workExperience.items.map((item, i) => (
        <Entry
          key={`work-${item.companyName}-${i}`}
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
    <Section title="实习经验">
      {internshipExperience.items.map((item, i) => (
        <Entry
          key={`intern-${item.companyName}-${i}`}
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
    <Section title="项目经验">
      {projectExperience.items.map((item, i) => (
        <Entry
          key={`project-${item.projectName}-${i}`}
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
    <Section title="校园经历">
      {campusExperience.items.map((item, i) => (
        <Entry
          key={`campus-${item.experienceName}-${i}`}
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
  const { theme, font } = useResumeContext()
  const { skillSpecialty } = useResumeStore()

  return (
    <Section title="技能特长">
      {skillSpecialty.description && <div className="prose">{parser(skillSpecialty.description)}</div>}
      {skillSpecialty.skills?.length > 0 && (
        <div className="grid gap-4 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {skillSpecialty.skills.map((skill, i) => {
            const percentage = skillProficiencyMap[skill.proficiencyLevel] || 50
            return (
              <div key={`skill-${skill.label}-${i}`} className="flex flex-col gap-1">
                {skill.displayType === 'percentage' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ backgroundColor: theme.progressBarBg }}>
                      <div
                        className="h-full transition-all duration-300"
                        style={{ width: `${percentage}%`, backgroundColor: theme.progressBarFill }}
                      />
                    </div>
                    <span className="min-w-[3em] text-right" style={{ fontSize: font.smallSize, color: theme.textMuted }}>
                      {percentage}
                      %
                    </span>
                  </div>
                )}
                <div style={{ fontSize: font.contentSize, color: theme.textPrimary, fontWeight: font.mediumWeight }}>
                  {skill.label}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function HonorsCertificatesModule() {
  const { font, spacing } = useResumeContext()
  const { honorsCertificates } = useResumeStore()

  return (
    <Section title="荣誉证书">
      {honorsCertificates.description && <div className="prose">{parser(honorsCertificates.description)}</div>}
      {honorsCertificates.certificates?.length > 0 && (
        <div style={{ fontSize: font.contentSize, lineHeight: spacing.lineHeight }}>
          {honorsCertificates.certificates.map((cert, i) => (
            <span key={`cert-${cert.name}-${i}`}>
              {i > 0 && '、'}
              {cert.name}
            </span>
          ))}
        </div>
      )}
    </Section>
  )
}

function SelfEvaluationModule() {
  const { selfEvaluation } = useResumeStore()
  return (
    <Section title="自我评价">
      <div className="prose">{parser(selfEvaluation.content)}</div>
    </Section>
  )
}

function HobbiesModule() {
  const { theme } = useResumeContext()
  const { hobbies } = useResumeStore()

  return (
    <Section title="兴趣爱好">
      {hobbies.description && <div className="prose">{parser(hobbies.description)}</div>}
      {hobbies.hobbies?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hobbies.hobbies.map((hobby, i) => (
            <Badge variant="outline" key={`hobby-${hobby.name}-${i}`} style={{ backgroundColor: theme.badgeBg }}>
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

interface BasicResumeContentProps {
  theme: ResumeTheme
  spacing: ResumeSpacing
  font: ResumeFont
}

export default function BasicResume({ theme, spacing, font }: BasicResumeContentProps) {
  const data = useResumeStore()
  const getVisibility = useResumeStore(state => state.getVisibility)
  const age = useAge(data.basics.birthMonth)

  return (
    <ResumeProvider theme={theme} spacing={spacing} font={font}>
      <div style={{ fontFamily: font.fontFamily }}>
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
