import RuledColumnLayout from '@/components/resume/template-layouts/ruled-column/v1'
import SingleColumnLayout from '@/components/resume/template-layouts/single-column/v1'
import AlignedEntryList from '@/components/resume/template-parts/aligned-entry-list/v1'
import BannerProfile from '@/components/resume/template-parts/banner-profile/v1'
import CenteredProfile from '@/components/resume/template-parts/centered-profile/v1'
import InlineFields from '@/components/resume/template-parts/inline-fields/v1'
import PlainEntryList from '@/components/resume/template-parts/plain-entry-list/v1'
import PlainRichText from '@/components/resume/template-parts/plain-rich-text/v1'
import RibbonHeading from '@/components/resume/template-parts/ribbon-heading/v1'
import SkillBadges from '@/components/resume/template-parts/skill-badges/v1'
import SkillMeters from '@/components/resume/template-parts/skill-meters/v1'
import TagList from '@/components/resume/template-parts/tag-list/v1'
import UnderlineHeading from '@/components/resume/template-parts/underline-heading/v1'

export const visualComponents = {
  layout: { 'single-column@1': SingleColumnLayout, 'ruled-column@1': RuledColumnLayout },
  header: { 'centered-profile@1': CenteredProfile, 'banner-profile@1': BannerProfile },
  heading: { 'underline-heading@1': UnderlineHeading, 'ribbon-heading@1': RibbonHeading },
  experience: { 'plain-entry-list@1': PlainEntryList, 'aligned-entry-list@1': AlignedEntryList },
  richText: { 'plain-rich-text@1': PlainRichText },
  skills: { 'skill-badges@1': SkillBadges, 'skill-meters@1': SkillMeters },
  fieldList: { 'inline-fields@1': InlineFields },
  tagList: { 'tag-list@1': TagList },
} as const
