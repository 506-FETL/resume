import SingleColumnLayout from '@/components/resume/template-layouts/single-column/v1'
import CenteredProfile from '@/components/resume/template-parts/centered-profile/v1'
import InlineFields from '@/components/resume/template-parts/inline-fields/v1'
import PlainEntryList from '@/components/resume/template-parts/plain-entry-list/v1'
import PlainRichText from '@/components/resume/template-parts/plain-rich-text/v1'
import SkillBadges from '@/components/resume/template-parts/skill-badges/v1'
import TagList from '@/components/resume/template-parts/tag-list/v1'
import UnderlineHeading from '@/components/resume/template-parts/underline-heading/v1'

export const visualComponents = {
  layout: { 'single-column@1': SingleColumnLayout },
  header: { 'centered-profile@1': CenteredProfile },
  heading: { 'underline-heading@1': UnderlineHeading },
  experience: { 'plain-entry-list@1': PlainEntryList },
  richText: { 'plain-rich-text@1': PlainRichText },
  skills: { 'skill-badges@1': SkillBadges },
  fieldList: { 'inline-fields@1': InlineFields },
  tagList: { 'tag-list@1': TagList },
} as const
