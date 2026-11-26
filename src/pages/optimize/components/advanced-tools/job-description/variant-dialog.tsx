import type { JdVariantDialogProps } from '@/components/jd-variant/components/generator-dialog'
import { useLayoutEffect } from 'react'
import { JdVariantDialog } from '@/components/jd-variant/components/generator-dialog'
import useJdVariantStore from '@/store/jd-variant'

export default function VariantDialog(props: JdVariantDialogProps) {
  const { open, parentResumeId } = props

  useLayoutEffect(() => {
    if (!open) return

    const { tasks, clearTask } = useJdVariantStore.getState()
    const phase = tasks[parentResumeId]?.phase

    if (phase === 'success' || phase === 'error' || phase === 'aborted')
      clearTask(parentResumeId)
  }, [open, parentResumeId])

  return <JdVariantDialog {...props} />
}
