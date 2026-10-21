import { parseTemplateDefinition } from '../../definition-schema'

/** 已发布定义不可原地升级；外观改变需发布新版本。 */
export const defaultTemplateV1 = parseTemplateDefinition({
  schemaVersion: 1,
  templateId: 'default',
  version: 1,
  renderContract: 'resume-v1',
  layout: { component: 'single-column@1', sectionOrder: 'resume', sectionVisibility: 'resume' },
  header: { component: 'centered-profile@1', fieldBinding: 'profile-with-job-intent@1' },
  sectionHeading: { component: 'underline-heading@1' },
  contentByKind: {
    experience: { component: 'plain-entry-list@1', metaLayout: 'title-subtitle-inline-date-right' },
    richText: { component: 'plain-rich-text@1' },
    skills: { component: 'skill-badges@1' },
    fieldList: { component: 'inline-fields@1', presentation: 'outlined-tags' },
    tagList: { component: 'tag-list@1' },
  },
  appearanceDefaults: {
    theme: { theme: 'default' },
    font: { fontFamily: 'noto-sans-sc', fontSize: 14 },
    spacing: { pageMargin: 16, sectionSpacing: 20, lineHeight: 1.6 },
  },
})
