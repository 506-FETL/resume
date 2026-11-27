import { deferDialog } from '@/components/deferred-dialog'

export const LibraryShareDialog = deferDialog(
  () => import('@/pages/share/components/quick-dialog'),
  '分享简历',
)

export const LibrarySyncDialog = deferDialog(
  () => import('../sync-resumes-dialog'),
  '同步本地简历',
)

export const LibraryTasksDialog = deferDialog(
  () => import('@/components/jd-variant/components/tasks-dialog'),
  '岗位版本任务',
  'DerivedJobsDialog',
)

export const LibraryVariantDialog = deferDialog(
  () => import('@/components/jd-variant/components/generator-dialog'),
  '创建岗位版本',
  'JdVariantDialog',
)
