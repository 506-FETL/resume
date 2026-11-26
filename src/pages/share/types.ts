import type {
  ResumeShareSnapshotSource,
  ShareVersionSelection,
} from '@/lib/supabase/resume/share.types'

export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>

export type VersionDialogSelection =
  | ShareVersionSelection
  | {
      kind: 'deleted-history'
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }
