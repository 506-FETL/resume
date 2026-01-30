import type { ApplicationStatus, StageStatus } from './types'

// 申请状态配置
export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, { label: string, color: string, bgColor: string }> = {
  saved: { label: 'Saved', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  applied: { label: 'Applied', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  screen: { label: 'Screen', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  interview: { label: 'Interview', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  offer: { label: 'Offer', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
}

// 申请状态顺序（用于进度条）
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'screen',
  'interview',
  'offer',
]

// 阶段状态配置
export const STAGE_STATUS_CONFIG: Record<StageStatus, { label: string, color: string }> = {
  待处理: { label: '待处理', color: 'text-gray-500' },
  进行中: { label: '进行中', color: 'text-blue-500' },
  已完成: { label: '已完成', color: 'text-green-500' },
  已拒绝: { label: '已拒绝', color: 'text-red-500' },
}

// 阶段状态选项
export const STAGE_STATUS_OPTIONS: StageStatus[] = ['待处理', '进行中', '已完成', '已拒绝']

// 视图模式标签
export const VIEW_MODE_LABELS = {
  list: 'List',
  board: 'Board',
}
