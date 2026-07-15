import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { updateProfile } from '@/lib/supabase/user'
import { useProfileStore } from '../../../store'
import { EditableField } from '../../editable-field'

interface EmailRowProps {
  initialEmail: string
}

export function EmailRow({ initialEmail }: EmailRowProps) {
  const [email, setEmail] = useState(initialEmail)
  const editing = useProfileStore(s => s.email.isEditing)
  const saving = useProfileStore(s => s.email.isSaving)
  const setEditing = useProfileStore(s => s.setEmailEditing)
  const setSaving = useProfileStore(s => s.setEmailSaving)

  useEffect(() => {
    setEmail(initialEmail)
  }, [initialEmail])

  const updateEmail = async () => {
    if (!email.trim()) {
      toast.error('邮箱地址不能为空')
      return
    }

    if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
      toast.error('请输入有效的邮箱地址')
      return
    }

    if (email === initialEmail) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      await updateProfile({ email })
      toast.success('邮箱更新请求已发送，请查收验证邮件')
      setEditing(false)
    }
    catch {
      toast.error('邮箱更新失败，请稍后重试')
    }
    finally {
      setSaving(false)
    }
  }

  const debouncedUpdateEmail = useDebounce(updateEmail, 500)

  return (
    <EditableField
      id="email"
      label="邮箱地址"
      icon={<Mail className="size-4 shrink-0" />}
      type="email"
      value={email}
      isEditing={editing}
      isSaving={saving}
      onValueChange={setEmail}
      onEdit={() => setEditing(true)}
      onSave={debouncedUpdateEmail}
      onCancel={() => {
        setEmail(initialEmail)
        setEditing(false)
      }}
    />
  )
}
