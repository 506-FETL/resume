import { historyComponent } from '../../utils/load-component'
import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import HistoryActionButton from '../shared/history-action-button'
import type PrintTask from './print-task'

const loadPrint = historyComponent(() => import('./print-task'), 'PrintTask')

export interface VersionPrintProps {
  documentRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState | null
  documentTitle: string
}

export default function VersionPdfExportButton({
  documentRef,
  documentState,
  documentTitle,
  snapshotError,
}: VersionPrintProps & { snapshotError: string | null }) {
  const [pending, setPending] = useState(false)
  const [Task, setTask] = useState<typeof PrintTask | null>(null)
  const error = snapshotError || documentState?.error

  useEffect(() => {
    if (pending && error) {
      toast.error(error)
      setPending(false)
    }
  }, [error, pending])

  async function handleExport() {
    if (error) {
      toast.error(error)

      return
    }

    setPending(true)

    try {
      const module = await loadPrint()

      setTask(() => module.default)
    } catch {
      toast.error('暂时无法加载 PDF 导出，请重试')
      setPending(false)
    }
  }

  return (
    <>
      <HistoryActionButton
        variant='outline'
        label={pending ? '准备中…' : '导出 PDF'}
        compact
        aria-busy={pending}
        disabled={pending}
        onClick={handleExport}
      >
        {pending ? <Spinner /> : <FileDown />}
      </HistoryActionButton>
      {pending && Task && documentState?.status === 'ready' && (
        <Task
          documentRef={documentRef}
          documentTitle={documentTitle}
          documentState={documentState}
          onComplete={setPending}
        />
      )}
    </>
  )
}
