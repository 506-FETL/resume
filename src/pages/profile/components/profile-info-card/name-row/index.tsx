import { User as UserIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentUserName } from '@/hooks/use-current-user'
import { useDebounce } from '@/hooks/use-debounce'
import { updateProfile } from '@/lib/supabase/user'
import { useProfileStore } from '../../../store'
import { EditableField } from '../../editable-field'

interface NameRowProps {
  initialFullName: string
}

export function NameRow({ initialFullName }: NameRowProps) {
  const currentName = useCurrentUserName()
  const [fullName, setFullName] = useState(initialFullName)
  const editing = useProfileStore(s => s.name.isEditing)
  const saving = useProfileStore(s => s.name.isSaving)
  const setEditing = useProfileStore(s => s.setNameEditing)
  const setSaving = useProfileStore(s => s.setNameSaving)

  useEffect(() => {
    setFullName(initialFullName)
  }, [initialFullName])

  const updateFullName = async () => {
    if (!fullName.trim()) {
      toast.error('用户名不能为空')
      return
    }

    if (fullName === currentName) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      await updateProfile({ data: { full_name: fullName } })
      toast.success('用户名更新成功')
      setEditing(false)
    }
    catch {
      toast.error('用户名更新失败，请稍后重试')
    }
    finally {
      setSaving(false)
    }
  }

  const debouncedUpdateName = useDebounce(updateFullName, 500)

  return (
    <EditableField
      id="name"
      label="用户名"
      icon={<UserIcon className="size-4 shrink-0" />}
      value={fullName}
      isEditing={editing}
      isSaving={saving}
      onValueChange={setFullName}
      onEdit={() => setEditing(true)}
      onSave={debouncedUpdateName}
      onCancel={() => {
        setFullName(initialFullName)
        setEditing(false)
      }}
    />
  )
}
