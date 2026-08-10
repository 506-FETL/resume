import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import useHistoryStore from '../../store'
import SaveVersionDialog from '../save-version-dialog'

export default function HistoryHeaderActions() {
  const { currentResume, loading } = useHistoryStore()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  useEffect(() => {
    setSaveDialogOpen(false)
  }, [currentResume?.resumeId])

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            常用操作
          </span>
          <p className="text-sm leading-6 text-muted-foreground">
            把当前内容保存为一个新版本，方便日后对比和恢复。
          </p>
        </div>

        <div className="grid gap-2.5">
          <Button
            className="justify-center"
            disabled={!currentResume || loading}
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save data-icon="inline-start" />
            保存当前版本
          </Button>
        </div>
      </section>

      <SaveVersionDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} />
    </>
  )
}
