import { useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateJobSubmissionDetails } from '@/lib/supabase/resume/submissions'
import { DURATION } from '@/lib/motion'
import type { JobSubmission } from '../../../submission-types'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import WorkflowDateField from '../workflow-date-field'

export default function SubmissionDetails({
  record,
  onClose,
}: {
  record: JobSubmission
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  const returnFocusRef = useRef(document.activeElement)
  const [open, setOpen] = useState(true)
  const [date, setDate] = useState(record.submitted_on)
  const [channel, setChannel] = useState(record.channel ?? '')
  const [note, setNote] = useState(record.note ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!reason.trim()) return setError('请填写更正原因')

    const scope = getTrackerAccountScope()

    setBusy(true)
    setError(null)

    try {
      await updateJobSubmissionDetails(
        record.id,
        {
          submittedOn: date,
          channel: channel.trim() || null,
          note: note.trim() || null,
          reason: reason.trim(),
        },
        createTrackerAccountGuard(scope),
      )

      if (!isTrackerAccountScopeCurrent(scope)) return

      useTrackerStore.getState().notifySubmissionChanged()
      await useTrackerStore.getState().reloadJobs()
      setOpen(false)
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope))
        setError(getTrackerErrorMessage(cause))
    } finally {
      if (isTrackerAccountScopeCurrent(scope)) setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value)
      }}
    >
      <DialogContent
        className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-lg'
        style={{ animationDuration: `${reduce ? 0 : DURATION.base}s` }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          if (
            returnFocusRef.current instanceof HTMLElement &&
            returnFocusRef.current.isConnected
          )
            returnFocusRef.current.focus({ preventScroll: true })

          onClose()
        }}
      >
        <DialogHeader className='shrink-0 pr-7'>
          <DialogTitle>更正投递信息</DialogTitle>
          <DialogDescription>
            更正原记录，保留修改前的信息和材料。当前流程阶段不变。
          </DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin-subtle -mx-1 min-h-0 space-y-4 overflow-y-auto px-1'>
          <fieldset disabled={busy} className='space-y-4'>
            <WorkflowDateField
              label='投递日期'
              value={date}
              onChange={setDate}
            />
            <div className='space-y-2'>
              <Label htmlFor='edit-submission-channel'>渠道（选填）</Label>
              <Input
                id='edit-submission-channel'
                maxLength={200}
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-submission-note'>备注（选填）</Label>
              <Textarea
                id='edit-submission-note'
                maxLength={4000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-submission-reason'>更正原因</Label>
              <Textarea
                id='edit-submission-reason'
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </fieldset>
          {error && (
            <Alert variant='destructive'>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className='shrink-0 border-t pt-4'>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            取消
          </Button>
          <Button disabled={busy} onClick={save}>
            {busy ? '正在保存…' : '保存更正'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
