import type { DerivedJobsDialogProps } from '@/components/jd-variant/components/tasks-dialog'
import type { JdVariantDialogProps } from '@/components/jd-variant/components/generator-dialog'
import { deferLibraryDialog } from './deferred'

export const LibraryShareDialog = deferLibraryDialog(
  () => import('@/pages/share/components/quick-dialog'),
  '分享简历',
)

export const LibrarySyncDialog = deferLibraryDialog(
  () => import('../sync-resumes-dialog'),
  '同步本地简历',
)

export const LibraryTasksDialog = deferLibraryDialog<DerivedJobsDialogProps>(
  () =>
    import('@/components/jd-variant/components/tasks-dialog').then(
      ({ DerivedJobsDialog }) => ({ default: DerivedJobsDialog }),
    ),
  '岗位版本任务',
)

export const LibraryVariantDialog = deferLibraryDialog<JdVariantDialogProps>(
  () =>
    import('@/components/jd-variant/components/generator-dialog').then(
      ({ JdVariantDialog }) => ({ default: JdVariantDialog }),
    ),
  '创建岗位版本',
)
