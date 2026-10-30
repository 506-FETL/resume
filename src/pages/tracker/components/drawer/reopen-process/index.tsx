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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DURATION } from '@/lib/motion'
import { TrackerProcessError } from '@/lib/supabase/resume/tracker-companies'
import useTrackerStore from '../../../store'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import type { ReopenProcessInput } from '../../../types'
import { getTrackerErrorMessage } from '../../../utils'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import WorkflowDateField from '../workflow-date-field'

function ReopenForm({
  request,
}: {
  request: {
    jobId: string
    eventId: string
    target: ReopenProcessInput['target']
  }
}) {
  const reduce = useReducedMotion()
  const returnFocusRef = useRef(document.activeElement)
  const pendingJobRef = useRef<string | null>(null)
  const [open, setOpen] = useState(true)
  const [target, setTarget] = useState(request.target)

  const [date, setDate] = useState<string | null>(
    new Date().toLocaleDateString('sv-SE'),
  )

  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const archived = useTrackerStore(
    (state) => state.jobs.find((job) => job.id === request.jobId)?.archived,
  )

  const save = async () => {
    if (!date) return setError(new Error('请选择恢复日期'))

    const scope = getTrackerAccountScope()

    setBusy(true)
    setError(null)

    try {
      await useTrackerStore
        .getState()
        .reopenProcess({ ...request, target, date, reason: reason.trim() })

      if (isTrackerAccountScopeCurrent(scope)) setOpen(false)
    } catch (cause) {
      if (isTrackerAccountScopeCurrent(scope)) setError(cause)
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
          useTrackerStore.getState().finishReopen()

          const job = useTrackerStore
            .getState()
            .jobs.find((row) => row.id === pendingJobRef.current)

          if (job) useTrackerStore.getState().openJobDrawer(job)
          else if (
            returnFocusRef.current instanceof HTMLElement &&
            returnFocusRef.current.isConnected
          )
            returnFocusRef.current.focus({ preventScroll: true })
        }}
      >
        <DialogHeader className='shrink-0 pr-7'>
          <DialogTitle>恢复流程</DialogTitle>
          <DialogDescription>
            继续这个岗位的原流程，保留之前的结束原因和面试记录。恢复到面试中会新增一轮面试。
          </DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin-subtle -mx-1 min-h-0 space-y-4 overflow-y-auto px-1'>
          <fieldset disabled={busy} className='space-y-4'>
            {archived && (
              <p className='text-sm text-muted-foreground'>
                恢复后会取消归档，并显示在当前岗位列表中。
              </p>
            )}
            <div className='space-y-2'>
              <Label htmlFor='reopen-stage'>恢复到</Label>
              <Select
                value={target}
                onValueChange={(value) =>
                  setTarget(value as ReopenProcessInput['target'])
                }
              >
                <SelectTrigger id='reopen-stage' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ['assessment', 'screen', 'written', 'interview'] as const
                  ).map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {APPLICATION_STATUS_CONFIG[stage].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <WorkflowDateField
              label='恢复日期'
              value={date}
              onChange={setDate}
            />
            <div className='space-y-2'>
              <Label htmlFor='reopen-reason'>恢复说明（选填）</Label>
              <Textarea
                id='reopen-reason'
                value={reason}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder='例如：招聘方重新联系，安排后续面试'
              />
            </div>
          </fieldset>
          {error != null && (
            <Alert variant='destructive'>
              <AlertDescription>
                {getTrackerErrorMessage(error)}
              </AlertDescription>
              {error instanceof TrackerProcessError && error.conflictJobId && (
                <Button
                  size='sm'
                  variant='outline'
                  className='mt-2 w-fit'
                  onClick={() => {
                    pendingJobRef.current = error.conflictJobId
                    setOpen(false)
                  }}
                >
                  打开冲突岗位
                </Button>
              )}
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
            {busy ? '正在恢复…' : '恢复流程'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ReopenProcessDialog() {
  const request = useTrackerStore((state) => state.reopenQueue[0])

  return request ? <ReopenForm key={request.eventId} request={request} /> : null
}
