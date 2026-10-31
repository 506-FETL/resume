import type { LucideIcon } from 'lucide-react'
import type { ShareStatusFilter } from './utils'
import type { SharePurpose } from '@/lib/supabase/resume/share.types'
import {
  Archive,
  Ban,
  BriefcaseBusiness,
  CircleCheck,
  CircleX,
  FileUser,
  Globe,
  MessageSquareText,
  Send,
  Target,
} from 'lucide-react'
import { DURATION, EASE } from '@/lib/motion'

export const SHARE_SEARCH_INPUT_ID = 'share-management-search'

export const SHARE_STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '有效' },
  { value: 'inactive', label: '已关闭' },
  { value: 'expired', label: '已过期' },
  { value: 'archived', label: '已归档' },
] as const

export const SHARE_GRID_CLASS =
  '@container/share-list flex min-w-0 flex-col gap-8 sm:gap-10'

export const SHARE_GROUP_CLASS = 'min-w-0'

export const SHARE_GROUP_HEADER_CLASS =
  'flex min-w-0 items-center gap-3 border-b border-border/80 px-3 pb-4 sm:gap-3.5 sm:px-4'

export const SHARE_PURPOSE_ICONS: Record<SharePurpose, LucideIcon> = {
  review: MessageSquareText,
  application: BriefcaseBusiness,
  showcase: Globe,
}

export const SHARE_STATUS_META: Record<
  Exclude<ShareStatusFilter, 'all'>,
  {
    label: string
    icon: LucideIcon
    dotClassName: string
    badgeClassName: string
    textClassName: string
  }
> = {
  active: {
    textClassName: 'text-emerald-700 dark:text-emerald-400',
    label: '有效',
    icon: CircleCheck,
    dotClassName: 'bg-emerald-500',
    badgeClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  inactive: {
    textClassName: 'text-muted-foreground',
    label: '已关闭',
    icon: Ban,
    dotClassName: 'bg-slate-400',
    badgeClassName:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300',
  },
  expired: {
    textClassName: 'text-amber-700 dark:text-amber-400',
    label: '已过期',
    icon: CircleX,
    dotClassName: 'bg-red-500',
    badgeClassName:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  },
  archived: {
    textClassName: 'text-muted-foreground',
    label: '已归档',
    icon: Archive,
    dotClassName: 'bg-violet-500',
    badgeClassName:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300',
  },
}

export const SHARE_ICON_STYLES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
] as const

export const SHARE_CARD_ICONS = [
  FileUser,
  BriefcaseBusiness,
  Send,
  Target,
] as const

export const SHARE_MOTION = {
  page: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.base, ease: EASE.out },
  },
  item: {
    initial: { opacity: 0, scale: 1, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: -4 },
    transition: { duration: DURATION.base, ease: EASE.out },
  },
  drawerItem: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.fast, ease: EASE.out },
  },
} as const
