import type { ResumePreviewData } from './components/drawer/types'
import type { ApplicationStatus, JobApplication, StageDetail, TrackerActivity, TrackerMetricKey, TrackerSortBy, TrackerSortDir } from './types'
import type { TemplateResumeDataInput } from '@/components/resume/runtime/context/resume-data-context'
import { DEFAULT_APPLICATION_INFO, DEFAULT_BASICS, DEFAULT_CAMPUS_EXPERIENCE, DEFAULT_EDU_BACKGROUND, DEFAULT_HOBBIES, DEFAULT_HONORS_CERTIFICATES, DEFAULT_INTERNSHIP_EXPERIENCE, DEFAULT_JOB_INTENT, DEFAULT_ORDER, DEFAULT_PROJECT_EXPERIENCE, DEFAULT_SELF_EVALUATION, DEFAULT_SKILL_SPECIALTY, DEFAULT_VISIBILITY, DEFAULT_WORK_EXPERIENCE, migrateOrder, migrateVisibility, normalizeResumeType, resolveResumeTemplateBinding } from '@/lib/schema'
import { APPLICATION_STATUS_CONFIG, APPLICATION_STATUS_ORDER, TRACKER_NEXT_ACTION_LABELS } from './const'
import { getEndedApplicationStage, transitionJobWorkflow } from './workflow'

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

// 将 Supabase snake_case 字段转换为 camelCase
export function mapSnakeToCamel(data: any): any {
  if (!data)
    return null

  return {
    type: data.type,
    basics: data.basics,
    jobIntent: data.jobIntent || data.job_intent,
    eduBackground: data.eduBackground || data.edu_background,
    workExperience: data.workExperience || data.work_experience,
    internshipExperience: data.internshipExperience || data.internship_experience,
    campusExperience: data.campusExperience || data.campus_experience,
    projectExperience: data.projectExperience || data.project_experience,
    skillSpecialty: data.skillSpecialty || data.skill_specialty,
    honorsCertificates: data.honorsCertificates || data.honors_certificates,
    selfEvaluation: data.selfEvaluation || data.self_evaluation,
    hobbies: data.hobbies,
    applicationInfo: data.applicationInfo || data.application_info,
    order: data.order,
    visibility: data.visibility,
  }
}

// 兼容旧调用点；完整职位转换应直接使用 transitionJobWorkflow。
export function autoCompleteStages(
  currentStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
  stageDetails: StageDetail[],
  autoSetCurrentDate = false,
): StageDetail[] {
  return transitionJobWorkflow(
    { status: currentStatus, stage_details: stageDetails, interview_sub_stages: [] },
    newStatus,
    autoSetCurrentDate ? undefined : '',
  ).stage_details
}

export function normalizeResumePreviewData(data: ResumePreviewData): TemplateResumeDataInput {
  const type = normalizeResumeType(data.type)

  return {
    basics: data.basics ?? DEFAULT_BASICS,
    job_intent: data.job_intent ?? DEFAULT_JOB_INTENT,
    application_info: data.application_info ?? DEFAULT_APPLICATION_INFO,
    edu_background: data.edu_background ?? DEFAULT_EDU_BACKGROUND,
    work_experience: data.work_experience ?? DEFAULT_WORK_EXPERIENCE,
    internship_experience: data.internship_experience ?? DEFAULT_INTERNSHIP_EXPERIENCE,
    campus_experience: data.campus_experience ?? DEFAULT_CAMPUS_EXPERIENCE,
    project_experience: data.project_experience ?? DEFAULT_PROJECT_EXPERIENCE,
    skill_specialty: data.skill_specialty ?? DEFAULT_SKILL_SPECIALTY,
    honors_certificates: data.honors_certificates ?? DEFAULT_HONORS_CERTIFICATES,
    self_evaluation: data.self_evaluation ?? DEFAULT_SELF_EVALUATION,
    hobbies: data.hobbies ?? DEFAULT_HOBBIES,
    order: migrateOrder(data.order ?? DEFAULT_ORDER),
    visibility: migrateVisibility(data.visibility ?? DEFAULT_VISIBILITY),
    type,
    templateBinding: resolveResumeTemplateBinding(data.templateBinding),
  }
}

export function getTrackerNextAction(job: JobApplication): TrackerNextAction {
  switch (job.status) {
    case 'saved':
      return { label: TRACKER_NEXT_ACTION_LABELS.saved, targetStatus: 'applied', emphasize: 'primary' }
    case 'applied':
      return { label: TRACKER_NEXT_ACTION_LABELS.applied, targetStatus: 'assessment', emphasize: 'primary' }
    case 'assessment':
      return { label: TRACKER_NEXT_ACTION_LABELS.assessment, targetStatus: 'screen', emphasize: 'primary' }
    case 'screen':
      return { label: TRACKER_NEXT_ACTION_LABELS.screen, targetStatus: 'written', emphasize: 'primary' }
    case 'written':
      return { label: TRACKER_NEXT_ACTION_LABELS.written, targetStatus: 'interview', emphasize: 'primary' }
    case 'interview':
      return { label: TRACKER_NEXT_ACTION_LABELS.interview, targetStatus: null, emphasize: 'primary' }
    case 'offer':
      return { label: TRACKER_NEXT_ACTION_LABELS.offer, targetStatus: null, emphasize: 'neutral' }
    case 'rejected':
      return { label: TRACKER_NEXT_ACTION_LABELS.rejected, targetStatus: null, emphasize: 'neutral' }
    default:
      return { label: '查看详情', targetStatus: null, emphasize: 'neutral' }
  }
}

export function getTrackerProgressHint(job: JobApplication) {
  if (job.status === 'interview') {
    const activeSubStage = job.interview_sub_stages.find(stage => stage.status === '进行中')
    if (activeSubStage) {
      return `面试中：正在进行${activeSubStage.label}`
    }

    const completedSubStageCount = job.interview_sub_stages.filter(stage => stage.status === '已完成').length
    if (completedSubStageCount > 0) {
      return `面试中：已完成 ${completedSubStageCount} 轮，等待下一轮安排`
    }

    return '面试中：等待安排首轮或补充面试记录'
  }

  if (job.status === 'offer')
    return '已进入积极结果阶段，建议尽快记录决策与后续安排'

  if (job.status === 'rejected') {
    const endedAt = getEndedApplicationStage(job)
    return endedAt ? `结束于：${APPLICATION_STATUS_CONFIG[endedAt].label}` : '流程已结束，建议补充原因或记录复盘信息'
  }

  const currentStage = job.stage_details.find(stage => stage.stage === job.status)
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
  const activeSubStage = job.interview_sub_stages.find(stage => stage.status === '进行中')

  return {
    hasResume: Boolean(job.resume_id),
    hasJobUrl: Boolean(job.job_url),
    hasSalary: Boolean(job.salary),
    activeSubStageLabel: activeSubStage?.label ?? null,
  }
}

export function getTrackerLoadErrorMeta(error: unknown) {
  let message = '加载失败'
  let description = ''

  if (error instanceof Error) {
    if (error.message.includes('未登陆') || error.message.includes('not authenticated')) {
      message = '请先登录'
      description = '需要登录后才能查看职位追踪'
    }
    else if (error.message.includes('network') || error.message.includes('fetch')) {
      message = '网络连接失败'
      description = '请检查网络连接后重试'
    }
    else if (error.message.includes('permission') || error.message.includes('policy')) {
      message = '权限不足'
      description = '无法访问职位数据，请联系管理员'
    }
    else if (error.message.includes('database') || error.message.includes('relation')) {
      message = '数据库错误'
      description = '数据表可能不存在或结构异常'
    }
    else {
      description = error.message
    }
  }

  return { message, description }
}

export function getTrackerErrorMessage(error: unknown, fallback = '未知错误') {
  return error instanceof Error ? error.message : fallback
}

// 概览聚合指标谓词。口径必须与 getTrackerOverviewStats 同源：
// applied=历史漏斗(投过就算)、interview/offer=未归档+当前状态、pending=待跟进口径
export function matchesMetric(job: JobApplication, key: TrackerMetricKey): boolean {
  switch (key) {
    case 'applied':
      return getFurthestStageIndex(job) >= APPLICATION_STATUS_ORDER.indexOf('applied')
    case 'interview':
      return !job.archived && job.status === 'interview'
    case 'offer':
      return !job.archived && job.status === 'offer'
    case 'pending':
      return isJobPendingFollowUp(job)
    default:
      return true
  }
}

export function filterJobs(
  jobs: JobApplication[],
  filterStatus: ApplicationStatus | null,
  keyword: string,
  showArchived = true,
  metricFilter: TrackerMetricKey | null = null,
): JobApplication[] {
  const trimmed = keyword.trim().toLowerCase()
  return jobs.filter((job) => {
    // showArchived 打开 = 「已归档视图」，只看已归档；关闭 = 常规视图，隐藏已归档
    if (showArchived ? !job.archived : job.archived)
      return false
    if (filterStatus && job.status !== filterStatus)
      return false
    if (metricFilter && !matchesMetric(job, metricFilter))
      return false
    if (!trimmed)
      return true
    return [job.company, job.position, job.location, job.salary ?? '']
      .some(field => field.toLowerCase().includes(trimmed))
  })
}

export const TRACKER_FOLLOW_UP_STALE_DAYS = 7

export interface TrackerOverviewStats {
  total: number
  applied: number // 历史投递总数：曾到达 applied 及以后的岗位（含已结束/已归档，历史漏斗口径）
  interview: number // 在办：面试中且未归档
  offer: number // 在办：已录用且未归档
  pending: number // 待跟进：未归档、非终态、超过陈旧阈值（P3 接入 next_action_date）
  responseRate: number // 曾进入 assessment 及以后 / 历史投递总数
}

// 停留天数：距上次更新的自然天数
export function getDaysInStage(job: { updated_at: string }): number {
  const last = new Date(job.updated_at).getTime()
  if (Number.isNaN(last))
    return 0
  return Math.max(0, Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24)))
}

// 距今天的自然天数：负=已逾期，0=今天，正=未来。无效日期返回 null。
export function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr)
    return null
  const target = new Date(`${dateStr}T00:00:00`).getTime()
  if (Number.isNaN(target))
    return null
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return Math.round((target - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
}

// 待跟进口径所需的最小字段结构（JobApplication 与列表摘要均满足）
export interface PendingFollowUpJob {
  status: ApplicationStatus
  updated_at: string
  archived: boolean
  next_action_date: string | null
}

// 待跟进口径：终态(offer/rejected)与已归档不计。
// 有 next_action_date 时以“今天到期或已逾期”为准；否则回退到陈旧度阈值。
export function isJobPendingFollowUp(job: PendingFollowUpJob): boolean {
  if (job.archived || job.status === 'offer' || job.status === 'rejected')
    return false

  const daysUntil = getDaysUntil(job.next_action_date)
  if (daysUntil !== null)
    return daysUntil <= 0

  return getDaysInStage(job) >= TRACKER_FOLLOW_UP_STALE_DAYS
}

function comparePendingFollowUpUrgency(left: JobApplication, right: JobApplication) {
  const leftHasDate = getDaysUntil(left.next_action_date) !== null
  const rightHasDate = getDaysUntil(right.next_action_date) !== null
  if (leftHasDate !== rightHasDate)
    return leftHasDate ? -1 : 1

  if (leftHasDate && rightHasDate) {
    const dateDifference = left.next_action_date!.localeCompare(right.next_action_date!)
    if (dateDifference !== 0)
      return dateDifference
  }

  const updatedDifference = Date.parse(left.updated_at) - Date.parse(right.updated_at)
  if (Number.isFinite(updatedDifference) && updatedDifference !== 0)
    return updatedDifference
  return left.id.localeCompare(right.id)
}

export function resolveTrackerMetricStatus(
  jobs: JobApplication[],
  metric: TrackerMetricKey | null,
): ApplicationStatus | null {
  if (!metric)
    return null
  if (metric !== 'pending')
    return metric

  const [pendingJob] = [...jobs]
    .filter(isJobPendingFollowUp)
    .sort(comparePendingFollowUpUrgency)
  return pendingJob?.status ?? null
}

export type NextActionTone = 'overdue' | 'today' | 'upcoming'

export interface NextActionBadge {
  label: string
  tone: NextActionTone
}

// 下一步日期徽标：逾期/今天/未来。无日期返回 null。
export function getNextActionBadge(job: JobApplication): NextActionBadge | null {
  // 终态与已归档不再提示下一步。
  if (job.archived || job.status === 'offer' || job.status === 'rejected')
    return null

  const daysUntil = getDaysUntil(job.next_action_date)
  if (daysUntil === null)
    return null

  if (daysUntil < 0)
    return { label: `逾期 ${Math.abs(daysUntil)} 天`, tone: 'overdue' }
  if (daysUntil === 0)
    return { label: '今天', tone: 'today' }
  if (daysUntil === 1)
    return { label: '明天', tone: 'upcoming' }
  return { label: `${daysUntil} 天后`, tone: 'upcoming' }
}

// 历史到达过的最深阶段索引（基于 APPLICATION_STATUS_ORDER）。
// 结束位置与保存的历史阶段共同还原漏斗；回退保留的真实日期仍属于历史经历。
export function getFurthestStageIndex(job: JobApplication): number {
  const endedAt = getEndedApplicationStage(job)
  let furthest = APPLICATION_STATUS_ORDER.indexOf(endedAt ?? job.status)
  for (const detail of job.stage_details) {
    if (detail.status === '已完成' || detail.status === '进行中' || detail.start_date) {
      const idx = APPLICATION_STATUS_ORDER.indexOf(detail.stage)
      if (idx > furthest)
        furthest = idx
    }
  }
  // 活动记录与当前可见阶段状态分离：回退会重算状态，但不抹去真实到达经历。
  for (const activity of job.activities) {
    if (activity.type !== 'status_change')
      continue
    for (const [index, stage] of APPLICATION_STATUS_ORDER.entries()) {
      const label = APPLICATION_STATUS_CONFIG[stage].label
      if ((activity.label === `推进到「${label}」` || activity.label === `回退到「${label}」`
        || activity.note === `结束于：${label}` || activity.note === `录用于：${label}`) && index > furthest) {
        furthest = index
      }
    }
  }
  return furthest
}

export function getTrackerOverviewStats(jobs: JobApplication[]): TrackerOverviewStats {
  const total = jobs.length
  const appliedIdx = APPLICATION_STATUS_ORDER.indexOf('applied')
  const responseIdx = APPLICATION_STATUS_ORDER.indexOf('assessment')
  // 历史漏斗口径：投过就算（含已结束/已归档的），据 stage_details 还原漏斗深度
  const appliedPlus = jobs.filter(j => getFurthestStageIndex(j) >= appliedIdx).length
  const responsePlus = jobs.filter(j => getFurthestStageIndex(j) >= responseIdx).length
  // 在办口径：已归档 = 停止跟进，从活跃计数中排除
  const active = jobs.filter(j => !j.archived)
  const interview = active.filter(j => j.status === 'interview').length
  const offer = active.filter(j => j.status === 'offer').length
  const pending = jobs.filter(isJobPendingFollowUp).length
  const responseRate = appliedPlus === 0 ? 0 : Math.round((responsePlus / appliedPlus) * 100)
  return { total, applied: appliedPlus, interview, offer, pending, responseRate }
}

// 列表排序比较器（返回新数组，不改原数组）
export function sortJobs(
  jobs: JobApplication[],
  sortBy: TrackerSortBy,
  sortDir: TrackerSortDir,
): JobApplication[] {
  const dir = sortDir === 'asc' ? 1 : -1
  const time = (value: string) => {
    const t = new Date(value).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  // rejected 不在 APPLICATION_STATUS_ORDER 中，按“走完全部阶段之后”排到末尾
  const statusRank = (status: ApplicationStatus) => {
    const idx = APPLICATION_STATUS_ORDER.indexOf(status)
    return idx === -1 ? APPLICATION_STATUS_ORDER.length : idx
  }

  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return (time(a.updated_at) - time(b.updated_at)) * dir
      case 'created':
        return (time(a.created_at) - time(b.created_at)) * dir
      case 'days':
        return (getDaysInStage(a) - getDaysInStage(b)) * dir
      case 'company':
        return a.company.localeCompare(b.company, 'zh-Hans-CN') * dir
      case 'status':
        return (statusRank(a.status) - statusRank(b.status)) * dir
      default:
        return 0
    }
  })
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
  const verb = toStatus === 'rejected'
    ? '结束流程于'
    : ((fromStatus === 'rejected' || toIdx < fromIdx) ? '回退到' : '推进到')

  return {
    id: crypto.randomUUID(),
    type: 'status_change',
    label: `${verb}「${toLabel}」`,
    at: new Date().toISOString(),
    ...((toStatus === 'rejected' || toStatus === 'offer') && fromStatus !== 'offer' && fromStatus !== 'rejected'
      ? { note: `${toStatus === 'rejected' ? '结束于' : '录用于'}：${APPLICATION_STATUS_CONFIG[fromStatus].label}` }
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
