import type { JobApplication, TrackerContact } from '../../../types'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceListItem } from '@/components/motion/presence-item'
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
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { isTrackerAccountScopeError } from '../../../lib/account-scope'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

interface ContactsProps {
  job: JobApplication
}

// 单行相等判断：用于逐行 dirty 计算，与全局保存解耦。
function contactEqual(
  a: TrackerContact | undefined,
  b: TrackerContact | undefined,
) {
  if (!a || !b) return false

  return (
    a.id === b.id &&
    a.name === b.name &&
    a.role === b.role &&
    a.channel === b.channel &&
    a.note === b.note
  )
}

export default function Contacts({ job }: ContactsProps) {
  const reduceMotion = useReducedMotion()
  const saveJobFields = useTrackerStore((state) => state.saveJobFields)
  const [contacts, setContacts] = useState<TrackerContact[]>(job.contacts)
  const [baseline, setBaseline] = useState<TrackerContact[]>(job.contacts)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<TrackerContact | null>(
    null,
  )

  const [deleteOpen, setDeleteOpen] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const deletingConfirmedRef = useRef(false)
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
    setDeleteOpen(false)
  }, [job.id])

  const saving = savingId !== null

  // 按行保存/删除：以服务端 baseline 为基，仅对该行落库；成功后仅把该行对齐服务端并更新基线，
  // 其它行的本地草稿保持不变（保存互不耦合）。含过期响应防护。
  const persistRow = async (
    rowId: string,
    dbNext: TrackerContact[],
    options: { successText: string; isDelete?: boolean },
  ) => {
    const requestJobId = job.id
    const requestGeneration = requestGenerationRef.current + 1

    requestGenerationRef.current = requestGeneration

    const isCurrentRequest = () =>
      jobIdRef.current === requestJobId &&
      requestGenerationRef.current === requestGeneration

    setSavingId(rowId)

    try {
      const edited = dbNext.find((contact) => contact.id === rowId)

      const savedJob = await saveJobFields(job.id, (current) => ({
        contacts: options.isDelete
          ? current.contacts.filter((contact) => contact.id !== rowId)
          : current.contacts.some((contact) => contact.id === rowId)
            ? current.contacts.map((contact) =>
                contact.id === rowId && edited ? edited : contact,
              )
            : edited
              ? [...current.contacts, edited]
              : current.contacts,
      }))

      if (isCurrentRequest()) {
        setBaseline(savedJob.contacts)

        setContacts((prev) => {
          if (options.isDelete) return prev.filter((c) => c.id !== rowId)

          const savedRow = savedJob.contacts.find((c) => c.id === rowId)

          return prev.map((c) => (c.id === rowId ? (savedRow ?? c) : c))
        })

        toast.success(options.successText)
      }
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    } finally {
      if (isCurrentRequest()) setSavingId(null)
    }
  }

  const handleAdd = () => {
    if (saving) return

    const contact: TrackerContact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      channel: '',
      note: '',
    }

    setContacts((prev) => [...prev, contact])
  }

  const handleFieldChange = (id: string, patch: Partial<TrackerContact>) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
  }

  const handleSaveRow = async (id: string) => {
    if (saving) return

    const edited = contactsRef.current.find((c) => c.id === id)

    if (!edited) return

    const base = baselineRef.current
    const exists = base.some((c) => c.id === id)

    const dbNext = exists
      ? base.map((c) => (c.id === id ? edited : c))
      : [...base, edited]

    await persistRow(id, dbNext, { successText: '已保存联系人' })
  }

  const handleDelete = async () => {
    const deleteId = pendingDelete?.id

    if (!deleteId || saving) return

    deletingConfirmedRef.current = true
    setDeleteOpen(false)

    const dbNext = baselineRef.current.filter((c) => c.id !== deleteId)

    await persistRow(deleteId, dbNext, {
      successText: '已删除联系人',
      isDelete: true,
    })
  }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className='flex flex-col gap-3 outline-none'
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <UserRound className='size-4 text-muted-foreground' />
          <h3 className='text-sm font-semibold'>联系人</h3>
          <span className='text-xs text-muted-foreground'>
            {contacts.length}
          </span>
        </div>
        <Button
          variant='outline'
          size='sm'
          className='h-8'
          disabled={saving}
          onClick={handleAdd}
        >
          <Plus className='size-3.5' />
          添加联系人
        </Button>
      </div>

      <AnimatedContent
        animationKey={contacts.length === 0 ? 'empty' : 'contacts'}
      >
        {contacts.length === 0 ? (
          <p className='text-sm text-muted-foreground'>暂无联系人</p>
        ) : (
          <ul className='flex flex-col gap-3'>
            <AnimatePresence initial={false} mode='popLayout'>
              {contacts.map((contact) => {
                const baselineRow = baseline.find((c) => c.id === contact.id)
                const isPersisted = Boolean(baselineRow)
                const rowDirty = !contactEqual(contact, baselineRow)

                return (
                  <PresenceListItem
                    key={contact.id}
                    layout={reduceMotion ? false : 'position'}
                    layoutDependency={contacts.length}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: reduceMotion ? 0 : DURATION.fast,
                        ease: EASE.in,
                      },
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            duration: DURATION.base,
                            ease: EASE.out,
                            layout: SPRING.layout,
                          }
                    }
                    className='flex flex-col gap-3 rounded-lg border bg-card p-3'
                  >
                    <div className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'>
                      <label className='flex flex-col gap-1'>
                        <span className='text-[11px] font-medium text-muted-foreground'>
                          姓名
                        </span>
                        <Input
                          value={contact.name}
                          placeholder='如 佘明聪'
                          className='h-8 font-medium'
                          disabled={saving}
                          onChange={(e) =>
                            handleFieldChange(contact.id, {
                              name: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className='flex flex-col gap-1'>
                        <span className='text-[11px] font-medium text-muted-foreground'>
                          角色
                        </span>
                        <Input
                          value={contact.role}
                          placeholder='HR / 面试官 / 内推人'
                          className='h-8'
                          disabled={saving}
                          onChange={(e) =>
                            handleFieldChange(contact.id, {
                              role: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className='flex flex-col gap-1'>
                        <span className='text-[11px] font-medium text-muted-foreground'>
                          联系方式
                        </span>
                        <Input
                          value={contact.channel}
                          placeholder='微信 / 邮箱 / 电话'
                          className='h-8'
                          disabled={saving}
                          onChange={(e) =>
                            handleFieldChange(contact.id, {
                              channel: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className='flex flex-col gap-1'>
                        <span className='text-[11px] font-medium text-muted-foreground'>
                          备注
                        </span>
                        <Input
                          value={contact.note}
                          placeholder='如账号、补充说明'
                          className='h-8'
                          disabled={saving}
                          onChange={(e) =>
                            handleFieldChange(contact.id, {
                              note: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className='flex shrink-0 items-center justify-end gap-1'>
                      {rowDirty && (
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-8'
                          disabled={saving}
                          onClick={() => handleSaveRow(contact.id)}
                        >
                          保存
                        </Button>
                      )}
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                        aria-label='删除联系人'
                        disabled={saving}
                        onClick={(event) => {
                          if (isPersisted) {
                            deleteTriggerRef.current = event.currentTarget
                            deletingConfirmedRef.current = false
                            setPendingDelete(contact)
                            setDeleteOpen(true)
                          } else
                            setContacts((prev) =>
                              prev.filter((c) => c.id !== contact.id),
                            )
                        }}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </PresenceListItem>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </AnimatedContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          size='sm'
          className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
          style={{
            animationDuration: `${reduceMotion ? 0 : deleteOpen ? DURATION.base : DURATION.fast}s`,
            animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()

            const target =
              !deletingConfirmedRef.current &&
              deleteTriggerRef.current?.isConnected
                ? deleteTriggerRef.current
                : sectionRef.current

            target?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除联系人？</AlertDialogTitle>
            <AlertDialogDescription>
              {`「${pendingDelete?.name.trim() || '该联系人'}」将永久删除，无法恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={handleDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
