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

// 单行相等判断：用于逐行 dirty 计算，与全局保存解耦。
function contactEqual(a: TrackerContact | undefined, b: TrackerContact | undefined) {
  if (!a || !b)
    return false
  return a.id === b.id
    && a.name === b.name
    && a.role === b.role
    && a.channel === b.channel
    && a.note === b.note
}

export default function Contacts({ job }: ContactsProps) {
  const { syncJob } = useTrackerStore()
  const [contacts, setContacts] = useState<TrackerContact[]>(job.contacts)
  const [baseline, setBaseline] = useState<TrackerContact[]>(job.contacts)
  const [savingId, setSavingId] = useState<string | null>(null)
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

  // 切换职位时重置本组件状态（同职位的完整行回写不覆盖已接纳的联系人基线）。
  useEffect(() => {
    requestGenerationRef.current += 1
    setContacts(jobContactsRef.current)
    setBaseline(jobContactsRef.current)
    setSavingId(null)
    setPendingDeleteId(null)
  }, [job.id])

  const saving = savingId !== null

  // 按行保存/删除：以服务端 baseline 为基，仅对该行落库；成功后仅把该行对齐服务端并更新基线，
  // 其它行的本地草稿保持不变（保存互不耦合）。含过期响应防护。
  const persistRow = async (
    rowId: string,
    dbNext: TrackerContact[],
    options: { successText: string, isDelete?: boolean },
  ) => {
    const requestJobId = job.id
    const requestGeneration = requestGenerationRef.current + 1
    requestGenerationRef.current = requestGeneration
    const isCurrentRequest = () => (
      jobIdRef.current === requestJobId
      && requestGenerationRef.current === requestGeneration
    )

    setSavingId(rowId)
    try {
      const savedJob = await updateCompany(job.id, { contacts: dbNext })
      const isStillShowingRequestJob = jobIdRef.current === requestJobId
      if (isCurrentRequest()) {
        syncJob(savedJob)
        setBaseline(savedJob.contacts)
        setContacts((prev) => {
          if (options.isDelete)
            return prev.filter(c => c.id !== rowId)
          const savedRow = savedJob.contacts.find(c => c.id === rowId)
          return prev.map(c => (c.id === rowId ? (savedRow ?? c) : c))
        })
        toast.success(options.successText)
      }
      else if (!isStillShowingRequestJob) {
        syncJob(savedJob)
      }
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      if (isCurrentRequest())
        setSavingId(null)
    }
  }

  const handleAdd = () => {
    if (saving)
      return
    const contact: TrackerContact = { id: crypto.randomUUID(), name: '', role: '', channel: '', note: '' }
    setContacts(prev => [...prev, contact])
  }

  const handleFieldChange = (id: string, patch: Partial<TrackerContact>) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleSaveRow = async (id: string) => {
    if (saving)
      return
    const edited = contactsRef.current.find(c => c.id === id)
    if (!edited)
      return
    const base = baselineRef.current
    const exists = base.some(c => c.id === id)
    const dbNext = exists ? base.map(c => (c.id === id ? edited : c)) : [...base, edited]
    await persistRow(id, dbNext, { successText: '已保存联系人' })
  }

  const handleDelete = async () => {
    const deleteId = pendingDeleteId
    if (!deleteId || saving)
      return
    setPendingDeleteId(null)
    const dbNext = baselineRef.current.filter(c => c.id !== deleteId)
    await persistRow(deleteId, dbNext, { successText: '已删除联系人', isDelete: true })
  }

  const pendingDeleteContact = contacts.find(contact => contact.id === pendingDeleteId)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">联系人</h3>
          <span className="text-xs text-muted-foreground">{contacts.length}</span>
        </div>
        <Button variant="outline" size="sm" className="h-8" disabled={saving} onClick={handleAdd}>
          <Plus className="size-3.5" />
          添加联系人
        </Button>
      </div>

      {contacts.length === 0
        ? (
            <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
              还没有联系人。记录 HR、面试官或内推人，方便后续跟进沟通。
            </p>
          )
        : (
            <ul className="flex flex-col gap-3">
              {contacts.map((contact) => {
                const baselineRow = baseline.find(c => c.id === contact.id)
                const isPersisted = Boolean(baselineRow)
                const rowDirty = !contactEqual(contact, baselineRow)
                return (
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
                    {rowDirty && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={saving}
                        onClick={() => handleSaveRow(contact.id)}
                      >
                        保存
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="删除联系人"
                      disabled={saving}
                      onClick={() => {
                        if (isPersisted)
                          setPendingDeleteId(contact.id)
                        else setContacts(prev => prev.filter(c => c.id !== contact.id))
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                )
              })}
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
            <AlertDialogAction disabled={saving} onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
