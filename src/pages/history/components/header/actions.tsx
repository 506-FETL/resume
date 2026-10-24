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
  const { currentResume, loading } = useHistoryStore()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  useEffect(() => {
    setSaveDialogOpen(false)
  }, [activeResumeId])

  return (
    <>
      <Button
        className='shrink-0'
        disabled={
          !currentResume || currentResume.resumeId !== activeResumeId || loading
        }
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
