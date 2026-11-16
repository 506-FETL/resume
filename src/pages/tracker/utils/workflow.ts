import type {
  ApplicationStatus,
  JobApplication,
  StageDetail,
  TrackerActivity,
} from '../types'
import {
  APPLICATION_STATUS_CONFIG,
  APPLICATION_STATUS_ORDER,
  TRACKER_NEXT_ACTION_LABELS,
} from '../const'
import { getEndedApplicationStage, transitionJobWorkflow } from '../workflow'

export interface TrackerNextAction {
  label: string
  targetStatus: ApplicationStatus | null
  emphasize: 'primary' | 'neutral'
}

export interface TrackerMetaSummary {
  hasResume: boolean
  hasJobUrl: boolean
  hasSalary: boolean
  activeSubStageLabel: string | null
}

export function autoCompleteStages(
  currentStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
  stageDetails: StageDetail[],
  autoSetCurrentDate = false,
): StageDetail[] {
  return transitionJobWorkflow(
    {
      status: currentStatus,
      stage_details: stageDetails,
      interview_sub_stages: [],
    },
    newStatus,
    autoSetCurrentDate ? undefined : '',
  ).stage_details
}

export function getTrackerNextAction(job: JobApplication): TrackerNextAction {
  switch (job.status) {
    case 'saved':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.saved,
        targetStatus: 'applied',
        emphasize: 'primary',
      }
    case 'applied':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.applied,
        targetStatus: 'assessment',
        emphasize: 'primary',
      }
    case 'assessment':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.assessment,
        targetStatus: 'screen',
        emphasize: 'primary',
      }
    case 'screen':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.screen,
        targetStatus: 'written',
        emphasize: 'primary',
      }
    case 'written':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.written,
        targetStatus: 'interview',
        emphasize: 'primary',
      }
    case 'interview':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.interview,
        targetStatus: null,
        emphasize: 'primary',
      }
    case 'offer':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.offer,
        targetStatus: null,
        emphasize: 'neutral',
      }
    case 'rejected':
      return {
        label: TRACKER_NEXT_ACTION_LABELS.rejected,
        targetStatus: null,
        emphasize: 'neutral',
      }
    default:
      return { label: '查看详情', targetStatus: null, emphasize: 'neutral' }
  }
}

export function getTrackerProgressHint(job: JobApplication) {
  if (job.status === 'interview') {
    const activeSubStage = job.interview_sub_stages.find(
      (stage) => stage.status === '进行中',
    )

    if (activeSubStage) {
      return `面试中：正在进行${activeSubStage.label}`
    }

    const completedSubStageCount = job.interview_sub_stages.filter(
      (stage) => stage.status === '已完成',
    ).length

    if (completedSubStageCount > 0) {
      return `面试中：已完成 ${completedSubStageCount} 轮，等待下一轮安排`
    }

    return '面试中：等待安排首轮或补充面试记录'
  }

  if (job.status === 'offer')
    return '已进入积极结果阶段，建议尽快记录决策与后续安排'

  if (job.status === 'rejected') {
    const endedAt = getEndedApplicationStage(job)

    return endedAt
      ? `结束于：${APPLICATION_STATUS_CONFIG[endedAt].label}`
      : '流程已结束，建议补充原因或记录复盘信息'
  }

  const currentStage = job.stage_details.find(
    (stage) => stage.stage === job.status,
  )

  const stageDate = currentStage?.start_date

  switch (job.status) {
    case 'saved':
      return '已保存职位信息，下一步建议尽快投递'
    case 'applied':
      return stageDate
        ? `已投递，正在等待初筛反馈`
        : '已投递，建议补充投递时间与反馈记录'
    case 'screen':
      return '简历筛选中，等待进入下一轮流程'
    case 'assessment':
      return '测评中，建议记录测评安排与反馈'
    case 'written':
      return '笔试中，建议记录笔试安排与反馈'
    default:
      return '查看详情以补充更多跟进记录'
  }
}

export function getTrackerMetaSummary(job: JobApplication): TrackerMetaSummary {
  const activeSubStage = job.interview_sub_stages.find(
    (stage) => stage.status === '进行中',
  )

  return {
    hasResume: Boolean(job.resume_id),
    hasJobUrl: Boolean(job.job_url),
    hasSalary: Boolean(job.salary),
    activeSubStageLabel: activeSubStage?.label ?? null,
  }
}

// 构造一条「状态推进/回退」活动。所有改状态入口共用，保证时间线记录一致。
export function buildStatusChangeActivity(
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus,
): TrackerActivity {
  const toLabel = APPLICATION_STATUS_CONFIG[toStatus].label
  const fromIdx = APPLICATION_STATUS_ORDER.indexOf(fromStatus)
  const toIdx = APPLICATION_STATUS_ORDER.indexOf(toStatus)

  // rejected 不在历史漏斗顺序中；终态返回在办阶段也属于纠正进度。
  const verb =
    toStatus === 'rejected'
      ? '结束流程于'
      : fromStatus === 'rejected' || toIdx < fromIdx
        ? '回退到'
        : '推进到'

  return {
    id: crypto.randomUUID(),
    type: 'status_change',
    label: `${verb}「${toLabel}」`,
    at: new Date().toISOString(),
    ...((toStatus === 'rejected' || toStatus === 'offer') &&
    fromStatus !== 'offer' &&
    fromStatus !== 'rejected'
      ? {
          note: `${toStatus === 'rejected' ? '结束于' : '录用于'}：${APPLICATION_STATUS_CONFIG[fromStatus].label}`,
        }
      : {}),
  }
}

// 在既有 activities 上追加一条状态变更（供改状态时统一调用）
export function appendStatusChangeActivity(
  job: Pick<JobApplication, 'status' | 'activities'>,
  toStatus: ApplicationStatus,
): TrackerActivity[] {
  return [...job.activities, buildStatusChangeActivity(job.status, toStatus)]
}
