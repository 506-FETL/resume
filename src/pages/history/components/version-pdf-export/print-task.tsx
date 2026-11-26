import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { VersionPrintProps } from './index'
import { useEffect, useRef } from 'react'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'

export default function PrintTask({
  documentRef,
  documentState,
  documentTitle,
  onComplete,
}: VersionPrintProps & {
  documentState: ResumeDocumentState
  onComplete: (pending: false) => void
}) {
  const startedRef = useRef(false)

  const print = useResumePrint({
    contentRef: documentRef,
    documentState,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
  })

  useEffect(() => {
    if (startedRef.current) return

    startedRef.current = true
    print().finally(() => onComplete(false))
  }, [onComplete, print])

  return null
}

export { PrintTask }
