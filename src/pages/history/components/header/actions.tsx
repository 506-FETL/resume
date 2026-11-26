import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import useHistoryStore from '../../store'
import SaveVersionDialog from '../save-version-dialog'

export default function HistoryHeaderActions({
  activeResumeId,
}: {
  activeResumeId: string | null
}) {
  const canSave = useHistoryStore((state) =>
    Boolean(
      state.currentResume &&
      state.currentResume.resumeId === activeResumeId &&
      !state.currentResumeLoading &&
      !state.currentResumeError &&
      state.versionSummaryReady &&
      state.versionTotal !== null &&
      (state.versionTotal === 0 || state.latestVersion !== null) &&
      !state.savingCurrent,
    ),
  )

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  useEffect(() => {
    setSaveDialogOpen(false)
  }, [activeResumeId])

  return (
    <>
      <Button
        className='shrink-0'
        disabled={!canSave}
        onClick={() => setSaveDialogOpen(true)}
      >
        <Save data-icon='inline-start' />
        保存当前版本
      </Button>

      <SaveVersionDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
      />
    </>
  )
}
