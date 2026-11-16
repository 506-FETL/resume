import type {
  HistoryCurrentResume,
  HistoryResumeOption,
  HistoryVersionGroup,
} from '../types'
import type {
  ResumeHistoryOptionRecord,
  ResumeHistoryResumeRecord,
  ResumeHistoryVersionListItem,
  ResumeHistoryVersionListRow,
  ResumeHistoryVersionRecord,
  ResumeHistoryVersionRow,
} from '@/lib/supabase/resume/history'
import dayjs from 'dayjs'
import { normalizeResumeType } from '@/lib/schema'
import { createResumeSnapshotHash } from '@/lib/supabase/resume/history/snapshot'
import { RESUME_TYPE_LABEL_MAP } from '../const'
import { normalizeTags } from './snapshot'
import { buildResumeSnapshot } from './snapshot'

export function normalizeHistoryVersionListItem(
  row: ResumeHistoryVersionListRow,
): ResumeHistoryVersionListItem {
  return { ...row, tags: normalizeTags(row.tags) }
}

export function normalizeHistoryVersion(
  version: ResumeHistoryVersionRow,
): ResumeHistoryVersionRecord {
  return {
    ...version,
    tags: normalizeTags(version.tags),
    snapshot: buildResumeSnapshot(version.snapshot),
  }
}

export async function buildCurrentResume(
  record: ResumeHistoryResumeRecord,
): Promise<HistoryCurrentResume> {
  const snapshot = buildResumeSnapshot(record)

  return {
    resumeId: record.resume_id,
    displayName: record.display_name?.trim() || '未命名简历',
    description: record.description?.trim() || '',
    updatedAt: record.updated_at,
    type: normalizeResumeType(record.type),
    snapshot,
    contentHash: await createResumeSnapshotHash(snapshot),
  }
}

export function buildHistoryResumeOption(
  record: ResumeHistoryOptionRecord,
): HistoryResumeOption {
  return {
    resumeId: record.resume_id,
    displayName: record.display_name?.trim() || '未命名简历',
    description: record.description?.trim() || '',
    updatedAt: record.updated_at,
    type: normalizeResumeType(record.type),
  }
}

export function getVersionTitle(version: ResumeHistoryVersionListItem) {
  return version.version_name?.trim() || `版本 V${version.version_no}`
}

export function getVersionSubtitle(version: ResumeHistoryVersionListItem) {
  if (version.milestone_name?.trim()) {
    return version.milestone_name.trim()
  }

  return `V${version.version_no}`
}

export function groupVersionsByDay(
  versions: ResumeHistoryVersionListItem[],
): HistoryVersionGroup[] {
  const groups = new Map<string, ResumeHistoryVersionListItem[]>()

  versions.forEach((version) => {
    const key = dayjs(version.created_at).format('YYYY-MM-DD')
    const current = groups.get(key) ?? []

    current.push(version)
    groups.set(key, current)
  })

  return Array.from(groups.entries()).map(([key, items]) => ({
    label: getDateGroupLabel(key),
    items,
  }))
}

export function getDateGroupLabel(value: string) {
  const date = dayjs(value)

  if (date.isSame(dayjs(), 'day')) {
    return '今天'
  }

  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) {
    return '昨天'
  }

  if (date.isSame(dayjs(), 'year')) {
    return date.format('M 月 D 日')
  }

  return date.format('YYYY 年 M 月 D 日')
}

export function getCurrentSyncState(
  currentResume: HistoryCurrentResume | null,
  versions: ResumeHistoryVersionListItem[],
) {
  if (!currentResume || versions.length === 0) {
    return {
      latestVersionNo: null,
      synced: false,
    }
  }

  const latest = versions[0]

  // content_hash 为 null（迁移前旧数据）→ 保守显示「有未保存的更新」，不误报已同步
  const synced =
    Boolean(latest?.content_hash) &&
    latest.content_hash === currentResume.contentHash

  return {
    latestVersionNo: latest?.version_no ?? null,
    synced,
  }
}

export function getResumeTypeLabel(type: string | null | undefined): string {
  return RESUME_TYPE_LABEL_MAP[normalizeResumeType(type)]
}
