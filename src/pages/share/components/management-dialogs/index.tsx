import { deferDialog } from '@/components/deferred-dialog'
import useShareStore from '../../store'
import { CreateShareDialog } from '../create-dialog/deferred'

const Settings = deferDialog(() => import('../settings-dialog'), '分享设置')
const Version = deferDialog(() => import('../version-dialog'), '更换分享版本')
const Archive = deferDialog(() => import('../archive-dialog'), '归档分享链接')
const Delete = deferDialog(() => import('../delete-dialog'), '删除分享链接')

async function getCurrentSnapshot(resumeId: string) {
  const { getResumeSnapshotById } =
    await import('@/lib/supabase/resume/share/release-source')

  return getResumeSnapshotById(resumeId)
}

export default function ManagementDialogs() {
  const create = useShareStore((state) => state.createDialogOpen)
  const settings = useShareStore((state) => state.settingsDialogOpen)
  const version = useShareStore((state) => state.versionDialogOpen)
  const archive = useShareStore((state) => state.archiveDialogOpen)
  const remove = useShareStore((state) => state.deleteDialogOpen)

  const {
    setCreateDialogOpen,
    closeSettingsDialog,
    closeVersionDialog,
    closeArchiveDialog,
    closeDeleteDialog,
  } = useShareStore.getState()

  return (
    <>
      <CreateShareDialog
        open={create}
        onClose={() => setCreateDialogOpen(false)}
      >
        {(Panel, opener) => (
          <Panel
            open={create}
            onOpenChange={setCreateDialogOpen}
            returnFocusTo={opener}
          />
        )}
      </CreateShareDialog>
      <Settings open={settings} onClose={closeSettingsDialog}>
        {(Panel, opener) => <Panel returnFocusTo={opener} />}
      </Settings>
      <Version open={version} onClose={closeVersionDialog}>
        {(Panel, opener) => (
          <Panel
            getCurrentSnapshot={getCurrentSnapshot}
            returnFocusTo={opener}
          />
        )}
      </Version>
      <Archive open={archive} onClose={closeArchiveDialog}>
        {(Panel, opener) => <Panel returnFocusTo={opener} />}
      </Archive>
      <Delete open={remove} onClose={closeDeleteDialog}>
        {(Panel, opener) => <Panel returnFocusTo={opener} />}
      </Delete>
    </>
  )
}
