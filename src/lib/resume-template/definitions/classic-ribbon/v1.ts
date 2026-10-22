import { parseTemplateDefinition } from '../../definition-schema'

/** 蓝灰斜角标题与金色页头；发布后的修改须新增版本。 */
export const classicRibbonTemplateV1 = parseTemplateDefinition({
  schemaVersion: 1,
  templateId: 'classic-ribbon',
  version: 1,
  renderContract: 'resume-v1',
  layout: { component: 'ruled-column@1', sectionOrder: 'resume', sectionVisibility: 'resume' },
  header: { component: 'banner-profile@1', fieldBinding: 'profile-with-job-intent@1' },
  sectionHeading: { component: 'ribbon-heading@1' },
  contentByKind: {
    experience: { component: 'aligned-entry-list@1', metaLayout: 'date-title-subtitle-columns' },
    richText: { component: 'plain-rich-text@1' },
    skills: { component: 'skill-meters@1' },
    fieldList: { component: 'inline-fields@1', presentation: 'outlined-tags' },
    tagList: { component: 'tag-list@1' },
  },
  palette: { primary: '#4f7483', accent: '#c1a065' },
  appearanceDefaults: {
    theme: { theme: 'default' },
    font: { fontFamily: 'noto-sans-sc', fontSize: 15 },
    spacing: { pageMargin: 24, sectionSpacing: 16, lineHeight: 1.6 },
  },
})
