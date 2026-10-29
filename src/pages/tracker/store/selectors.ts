import type { JobApplication } from '../types'
import { getFurthestStageIndex } from '../utils'

const displayFields = [
  'id',
  'user_id',
  'company',
  'tracker_company_id',
  'recruitment_batch',
  'referred_from_job_id',
  'has_submission',
  'unresolved_submissions',
  'position',
  'location',
  'salary',
  'company_logo',
  'resume_id',
  'job_url',
  'status',
  'archived',
  'focused_at',
  'next_action',
  'next_action_date',
  'created_at',
  'updated_at',
] as const

function sameDisplay(a: JobApplication, b: JobApplication) {
  return displayFields.every((field) => a[field] === b[field])
}

let listSource: JobApplication[] | undefined
let listSnapshot: JobApplication[] = []

let rows = new Map<
  string,
  { source: JobApplication; snapshot: JobApplication; depth: number }
>()

/** 只用于列表、筛选与统计展示。编辑和打开详情仍须由 store 按 id 读取最新记录。 */
export function selectTrackerListJobs({
  jobs,
}: {
  jobs: JobApplication[]
}): JobApplication[] {
  if (jobs === listSource) return listSnapshot

  const nextRows: typeof rows = new Map()

  const next = jobs.map((job) => {
    const previous = rows.get(job.id)

    if (previous?.source === job) {
      nextRows.set(job.id, previous)

      return previous.snapshot
    }

    const depth = getFurthestStageIndex(job)

    const snapshot =
      previous &&
      sameDisplay(previous.snapshot, job) &&
      previous.depth === depth
        ? previous.snapshot
        : job

    nextRows.set(job.id, { source: job, snapshot, depth })

    return snapshot
  })

  if (
    next.length !== listSnapshot.length ||
    next.some((job, index) => job !== listSnapshot[index])
  )
    listSnapshot = next

  listSource = jobs
  rows = nextRows

  return listSnapshot
}

let drawerSource: JobApplication | null = null
let drawerSnapshot: JobApplication | null = null

/** 隔离阶段笔记/轮次输入；阶段编辑器直接订阅原始草稿，抽屉外壳无需逐字重建。 */
export function selectTrackerDrawerJob({
  selectedJob: job,
}: {
  selectedJob: JobApplication | null
}) {
  if (job === drawerSource) return drawerSnapshot

  const previous = drawerSnapshot

  const sameStages =
    previous &&
    job &&
    previous.stage_details.length === job.stage_details.length &&
    previous.stage_details.every((stage, index) => {
      const next = job.stage_details[index]

      return (
        stage.stage === next.stage &&
        stage.status === next.status &&
        stage.start_date === next.start_date &&
        stage.source_stage === next.source_stage
      )
    })

  if (
    !previous ||
    !job ||
    !sameDisplay(previous, job) ||
    !sameStages ||
    previous.contacts !== job.contacts ||
    previous.activities !== job.activities
  )
    drawerSnapshot = job

  drawerSource = job

  return drawerSnapshot
}
