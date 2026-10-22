import type { ContentField, ProfileContent } from '@/lib/resume-template/content/types'
import { BriefcaseBusiness, GraduationCap } from 'lucide-react'
import { CommentableText } from '@/components/resume/fields/commentable-text'
import { useResumeContext } from '@/components/resume/runtime/context/resume-context'
import RibbonHeading from '../../ribbon-heading/v1'

export default function BannerProfile({ profile }: { profile: ProfileContent }) {
  const { font, spacing, theme } = useResumeContext()
  const fields = [profile.name, profile.workYears, ...profile.meta, ...profile.jobIntent, ...profile.contact].filter((field): field is ContentField => Boolean(field?.text))
  const order = ['name', 'age', 'workYears', 'jobIntent', 'intentionalCity', 'expectedSalary', 'dateEntry', 'phone', 'email', 'nativePlace']
  const rank = (field: ContentField) => order.includes(field.fieldKey) ? order.indexOf(field.fieldKey) : order.length
  fields.sort((a, b) => rank(a) - rank(b))

  return (
    <header id="resume-section-basics">
      <div data-pagination-atomic className="flex items-center" style={{ gap: 14, padding: '0 4px 18px', color: theme.primaryColor }}>
        <h1 className="m-0 whitespace-nowrap" style={{ fontSize: `calc(${font.nameSize} * 1.6)`, fontWeight: font.normalWeight }}>个人简历</h1>
        <div style={{ borderLeft: `1px solid ${theme.primaryColor}`, paddingLeft: 14 }}>
          <p className="m-0" style={{ fontSize: font.smallSize }}>认真准备，奔赴热爱</p>
          <p className="m-0" style={{ fontSize: font.nameSize, lineHeight: 1.3 }}>Personal resume</p>
        </div>
        <div aria-hidden data-resume-decoration className="ml-auto flex gap-2">
          {[{ name: 'education', Icon: GraduationCap }, { name: 'work', Icon: BriefcaseBusiness }].map(({ name, Icon }) => <span key={name} className="flex size-9 items-center justify-center rounded-full" style={{ background: theme.accentColor ?? theme.primaryColor, color: '#ffffff' }}><Icon size={21} strokeWidth={1.8} /></span>)}
        </div>
      </div>
      <div aria-hidden data-resume-decoration className="relative" style={{ height: 15, marginBottom: 12, background: theme.accentColor ?? theme.primaryColor }}>
        <span className="absolute inset-y-0 left-0" style={{ width: '64%', background: '#ffffff', clipPath: 'polygon(0 0, calc(100% - 17px) 0, 100% 100%, 0 100%)' }} />
        <span className="absolute inset-y-0 left-0" style={{ width: '63%', background: theme.primaryColor, clipPath: 'polygon(0 0, calc(100% - 17px) 0, 100% 100%, 0 100%)' }} />
      </div>
      <div style={{ marginLeft: 14, paddingLeft: 18, paddingBottom: spacing.sectionMargin, borderLeft: `1px solid ${theme.primaryColor}` }}>
        <RibbonHeading title="基本信息" />
        <div className="grid grid-cols-2" style={{ columnGap: 28, rowGap: spacing.paragraphSpacing, fontSize: font.contentSize, color: theme.textSecondary }}>
          {fields.map(field => (
            <div key={field.nodeKey} data-pagination-atomic className="flex min-w-0 items-baseline" style={{ gap: 4 }}>
              <span className="shrink-0" style={{ minWidth: '5em' }}>
                {field.label}
                ：
              </span>
              <span className="min-w-0 break-words"><CommentableText nodeKey={field.nodeKey} fieldLabel={field.label} /></span>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}
