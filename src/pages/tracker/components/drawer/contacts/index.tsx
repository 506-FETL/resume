import type { JobApplication, TrackerContact } from '../../../types'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateCompany } from '@/lib/supabase/resume'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

interface ContactsProps {
  job: JobApplication
}

export default function Contacts({ job }: ContactsProps) {
  const { syncJob } = useTrackerStore()
  const [contacts, setContacts] = useState<TrackerContact[]>(job.contacts)
  const [saving, setSaving] = useState(false)
  // 始终指向最新本地值，供保存时读取，避免闭包读到旧数组
  const contactsRef = useRef(contacts)
  contactsRef.current = contacts

  // 外部数据变化（切换职位/服务端回写）时同步本地
  useEffect(() => {
    setContacts(job.contacts)
  }, [job.id, job.contacts])

  const persist = async (next: TrackerContact[], successText: string) => {
    setContacts(next)
    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, { contacts: next })
      syncJob(savedJob)
      toast.success(successText)
    }
    catch (error) {
      toast.error('操作失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    const contact: TrackerContact = {
      id: crypto.randomUUID(),
      name: '',
      role: '',
      channel: '',
      note: '',
    }
    await persist([...contactsRef.current, contact], '已添加联系人')
  }

  // 本地即时更新（受控），失焦时才落库；落库读 ref 最新值避免覆盖其他字段
  const handleFieldChange = (id: string, patch: Partial<TrackerContact>) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const handleFieldCommit = async () => {
    await persist(contactsRef.current, '已保存')
  }

  const handleDelete = async (id: string) => {
    await persist(contactsRef.current.filter(c => c.id !== id), '已删除联系人')
  }

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
              {contacts.map(contact => (
                <li key={contact.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={contact.name}
                      placeholder="姓名"
                      className="h-8 flex-1 font-medium"
                      onChange={e => handleFieldChange(contact.id, { name: e.target.value })}
                      onBlur={handleFieldCommit}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="删除联系人"
                      disabled={saving}
                      onClick={() => handleDelete(contact.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={contact.role}
                      placeholder="角色（如 HR / 面试官 / 内推人）"
                      className="h-8"
                      onChange={e => handleFieldChange(contact.id, { role: e.target.value })}
                      onBlur={handleFieldCommit}
                    />
                    <Input
                      value={contact.channel}
                      placeholder="联系方式（微信 / 邮箱 / 电话）"
                      className="h-8"
                      onChange={e => handleFieldChange(contact.id, { channel: e.target.value })}
                      onBlur={handleFieldCommit}
                    />
                  </div>
                  <Input
                    value={contact.note}
                    placeholder="备注"
                    className="h-8"
                    onChange={e => handleFieldChange(contact.id, { note: e.target.value })}
                    onBlur={handleFieldCommit}
                  />
                </li>
              ))}
            </ul>
          )}
    </section>
  )
}
