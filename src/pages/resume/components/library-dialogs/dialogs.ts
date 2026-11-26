import type { DerivedJobsDialogProps } from '@/components/jd-variant/components/tasks-dialog'
import type { JdVariantDialogProps } from '@/components/jd-variant/components/generator-dialog'
import { deferDialog } from '@/components/deferred-dialog'

export const LibraryShareDialog = deferDialog(
  () => import('@/pages/share/components/quick-dialog'),
  '分享简历',
)

export const LibrarySyncDialog = deferDialog(
  () => import('../sync-resumes-dialog'),
  '同步本地简历',
)

export const LibraryTasksDialog = deferDialog<DerivedJobsDialogProps>(
  () =>
    import('@/components/jd-variant/components/tasks-dialog').then(
      ({ DerivedJobsDialog }) => ({ default: DerivedJobsDialog }),
    ),
  '岗位版本任务',
)

export const LibraryVariantDialog = deferDialog<JdVariantDialogProps>(
  () =>
    import('@/components/jd-variant/components/generator-dialog').then(
      ({ JdVariantDialog }) => ({ default: JdVariantDialog }),
    ),
  '创建岗位版本',
)
