import type { JobApplication, TrackerContact } from '../../../types'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateCompany } from '@/lib/supabase/resume'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

interface ContactsProps {
  job: JobApplication
}

function areContactsEqual(left: TrackerContact[], right: TrackerContact[]) {
  return left.length === right.length && left.every((contact, index) => {
    const other = right[index]
    return contact.id === other.id
      && contact.name === other.name
      && contact.role === other.role
      && contact.channel === other.channel
      && contact.note === other.note
  })
}

export default function Contacts({ job }: ContactsProps) {
  const { syncJob } = useTrackerStore()
  const [contacts, setContacts] = useState<TrackerContact[]>(job.contacts)
  const [baseline, setBaseline] = useState<TrackerContact[]>(job.contacts)
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const contactsRef = useRef(contacts)
  const baselineRef = useRef(baseline)
  const jobContactsRef = useRef(job.contacts)
  const jobIdRef = useRef(job.id)
  const requestGenerationRef = useRef(0)
  contactsRef.current = contacts
  baselineRef.current = baseline
  jobContactsRef.current = job.contacts
  jobIdRef.current = job.id

  // 同职位的完整行回写不覆盖本组件已接纳的联系人基线。
  useEffect(() => {
    requestGenerationRef.current += 1
    setContacts(jobContactsRef.current)
    setBaseline(jobContactsRef.current)
    setSaving(false)
    setPendingDeleteId(null)
  }, [job.id])

  const dirty = !areContactsEqual(contacts, baseline)

  const persist = async (
    next: TrackerContact[],
    options: { rollbackOnFailure: boolean, successText?: string },
  ) => {
    const requestJobId = job.id
    const requestGeneration = requestGenerationRef.current + 1
    const requestBaseline = baselineRef.current
    requestGenerationRef.current = requestGeneration
    const isCurrentRequest = () => (
      jobIdRef.current === requestJobId
      && requestGenerationRef.current === requestGeneration
    )

    setContacts(next)
    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, { contacts: next })
      const shouldUpdateLocalUi = isCurrentRequest()
      const isStillShowingRequestJob = jobIdRef.current === requestJobId
      if (shouldUpdateLocalUi) {
        syncJob(savedJob)
        setContacts(savedJob.contacts)
        setBaseline(savedJob.contacts)
      }
      else if (!isStillShowingRequestJob) {
        syncJob(savedJob)
      }
      if (options.successText) {
        toast.success(options.successText)
      }
    }
    catch (error) {
      if (isCurrentRequest() && options.rollbackOnFailure) {
        setContacts(requestBaseline)
      }
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      if (isCurrentRequest()) {
        setSaving(false)
      }
    }
  }

  const handleAdd = async () => {
    if (dirty || saving) {
      return
    }

    const contact: TrackerContact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      channel: '',
      note: '',
    }
    await persist([...contactsRef.current, contact], { rollbackOnFailure: true, successText: '已添加联系人' })
  }

  const handleFieldChange = (id: string, patch: Partial<TrackerContact>) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleSave = async () => {
    if (!dirty || saving) {
      return
    }

    await persist(contactsRef.current, { rollbackOnFailure: false })
  }

  const handleDelete = async () => {
    const deleteId = pendingDeleteId
    if (!deleteId || dirty || saving) {
      return
    }

    setPendingDeleteId(null)
    await persist(contactsRef.current.filter(c => c.id !== deleteId), { rollbackOnFailure: true, successText: '已删除联系人' })
  }

  const pendingDeleteContact = contacts.find(contact => contact.id === pendingDeleteId)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">联系人</h3>
          <span className="text-xs text-muted-foreground">{contacts.length}</span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto" disabled={!dirty || saving} onClick={handleSave}>
            保存修改
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto" disabled={dirty || saving} onClick={handleAdd}>
            <Plus className="size-3.5" />
            添加联系人
          </Button>
        </div>
      </div>

      {contacts.length === 0
        ? (
            <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              还没有联系人。记录 HR、面试官或内推人，方便后续跟进沟通。
            </p>
          )
        : (
            <ul className="flex flex-col gap-3">
              {contacts.map(contact => (
                <li key={contact.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,1.25fr)]">
                    <Input
                      value={contact.name}
                      placeholder="姓名"
                      className="h-8 font-medium"
                      disabled={saving}
                      onChange={e => handleFieldChange(contact.id, { name: e.target.value })}
                    />
                    <Input
                      value={contact.role}
                      placeholder="角色（如 HR / 面试官 / 内推人）"
                      className="h-8"
                      disabled={saving}
                      onChange={e => handleFieldChange(contact.id, { role: e.target.value })}
                    />
                    <Input
                      value={contact.channel}
                      placeholder="联系方式（微信 / 邮箱 / 电话）"
                      className="h-8"
                      disabled={saving}
                      onChange={e => handleFieldChange(contact.id, { channel: e.target.value })}
                    />
                    <Input
                      value={contact.note}
                      placeholder="备注"
                      className="h-8"
                      disabled={saving}
                      onChange={e => handleFieldChange(contact.id, { note: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="删除联系人"
                    disabled={dirty || saving}
                    onClick={() => setPendingDeleteId(contact.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={open => !open && setPendingDeleteId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除联系人？</AlertDialogTitle>
            <AlertDialogDescription>
              {`删除后将无法恢复。确定要删除${pendingDeleteContact?.name.trim() || '该联系人'}吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} onClick={() => setPendingDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={dirty || saving} onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
