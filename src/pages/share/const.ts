import type { LucideIcon } from 'lucide-react'
import type { ShareStatusFilter } from './utils'
import { Ban, BriefcaseBusiness, CircleCheck, CircleX, FileUser, Send, Target } from 'lucide-react'

export const SHARE_STATUS_META: Record<
  Exclude<ShareStatusFilter, 'all'>,
  {
    label: string
    icon: LucideIcon
    dotClassName: string
    badgeClassName: string
  }
> = {
  active: {
    label: '有效',
    icon: CircleCheck,
    dotClassName: 'bg-emerald-500',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  inactive: {
    label: '已关闭',
    icon: Ban,
    dotClassName: 'bg-slate-400',
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300',
  },
  expired: {
    label: '已过期',
    icon: CircleX,
    dotClassName: 'bg-red-500',
    badgeClassName: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
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
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  },
  item: {
    initial: { opacity: 0, scale: 0.97, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: -4 },
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
  },
  drawerItem: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.16, ease: 'easeOut' as const },
  },
} as const
