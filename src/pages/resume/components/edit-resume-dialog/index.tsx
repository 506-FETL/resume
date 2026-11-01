import type { FormEvent } from 'react'
import type { ResumeListItem } from '@/lib/schema'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  isOfflineResumeId,
  updateOfflineResumeMeta,
} from '@/lib/offline-resume-manager'
import { updateResumeConfig } from '@/lib/supabase/resume'
import { getErrorMessage } from '@/utils'

interface EditResumeDialogProps {
  resume: Pick<
    ResumeListItem,
    'resume_id' | 'display_name' | 'description' | 'isOffline'
  >
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (updatedResume: {
    display_name: string
    description: string
  }) => void
}

export default function EditResumeDialog({
  resume,
  open,
  onOpenChange,
  onSuccess,
}: EditResumeDialogProps) {
  const [displayName, setDisplayName] = useState(resume.display_name || '')
  const [description, setDescription] = useState(resume.description || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setDisplayName(resume.display_name || '')
      setDescription(resume.description || '')
    }
  }, [open, resume])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 判断是离线还是在线简历
      if (isOfflineResumeId(resume.resume_id)) {
        // 更新离线简历
        await updateOfflineResumeMeta(resume.resume_id, {
          display_name: displayName.trim() || '未命名简历',
          description: description.trim() || '',
        })
      } else {
        // 更新在线简历
        await updateResumeConfig(resume.resume_id, {
          display_name: displayName.trim() || null,
          description: description.trim() || null,
        })
      }

      toast.success('简历信息更新成功')
      onOpenChange(false)

      // 通知父组件更新成功
      if (onSuccess) {
        onSuccess({
          display_name: displayName.trim() || '未命名简历',
          description: description.trim() || '',
        })
      }
    } catch (error: unknown) {
      toast.error(`更新失败: ${getErrorMessage(error, '请重试')}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-125'>
        <DialogHeader>
          <DialogTitle>编辑简历信息</DialogTitle>
          <DialogDescription className='sr-only'>
            修改简历名称和描述。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className='gap-4 py-4'>
            <Field>
              <FieldLabel htmlFor='display_name'>
                简历名称（
                {displayName.length}
                /50）
              </FieldLabel>
              <Input
                id='display_name'
                placeholder='例如：前端开发简历'
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='description'>
                简历描述(
                {description.length}
                /200)
              </FieldLabel>
              <Textarea
                id='description'
                placeholder='例如：前端岗位投递'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={200}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type='submit' disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
