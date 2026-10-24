import type { FormEvent, ReactNode, RefObject } from 'react'
import { Plus } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateTemplateResume } from '@/hooks/use-create-template-resume'
import { getDefaultTemplateSelection } from '@/lib/resume-template/runtime/default-selection'
import useResumeListStore from '@/pages/resume/store'
import { useResumeCreationStore } from '@/store/resume-creation'

export default function CreateResumeCard({
  trigger,
  online,
  onCreated,
  open,
  onOpenChange,
  hideTrigger,
  returnFocusRef,
}: {
  trigger?: ReactNode
  online?: boolean
  onCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const reduceMotion = useReducedMotion()
  const isOnline = useResumeListStore((state) => state.isOnline)
  const [localOpen, setLocalOpen] = useState(false)
  const isCreating = open ?? localOpen
  const setIsCreating = onOpenChange ?? setLocalOpen
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const {
    createResume,
    loading: creating,
    error,
    retrying,
  } = useCreateTemplateResume()

  const loading = selecting || creating

  async function handleCreateResume(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setSelecting(true)
    setSelectionError(null)
    try {
      const selection = await getDefaultTemplateSelection()
      const ok = await createResume(
        {
          ...selection,
          mode: (online ?? isOnline) ? 'cloud' : 'local',
          displayName,
          description,
        },
        onCreated,
      )
      if (ok) handleCancel()
    } catch (caught) {
      setSelectionError(
        caught instanceof Error ? caught.message : '模板加载失败，请重试',
      )
    } finally {
      setSelecting(false)
    }
  }

  function handleCancel() {
    setSelectionError(null)
    setDisplayName('')
    setDescription('')
    useResumeCreationStore.getState().reset()
    setIsCreating(false)
  }

  return (
    <Dialog open={isCreating} onOpenChange={setIsCreating}>
      {!hideTrigger &&
        (trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <button
            type='button'
            onClick={() => setIsCreating(true)}
            className='flex min-h-48 h-full w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card p-6 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent/40 motion-reduce:transition-none'
          >
            <Plus className='size-6' aria-hidden />
            创建新简历
          </button>
        ))}

      <DialogContent
        className='sm:max-w-135'
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
        overlayClassName={reduceMotion ? 'animate-none!' : undefined}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef?.current?.isConnected) {
            event.preventDefault()
            returnFocusRef.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className='text-2xl font-bold'>创建新简历</DialogTitle>
          <DialogDescription className='sr-only'>
            填写简历名称和描述，将使用默认模板与完整应届生示例。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateResume}>
          <FieldGroup className='gap-6 py-6'>
            {/* 简历名称 */}
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
                className='h-11'
              />
            </Field>

            {/* 简历描述 */}
            <Field>
              <FieldLabel htmlFor='description'>
                简历描述（
                {description.length}
                /200）
              </FieldLabel>
              <Textarea
                id='description'
                placeholder='例如：前端岗位投递'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={200}
                className='resize-none'
              />
            </Field>

            <p className='text-sm text-muted-foreground'>
              默认模板 · 应届生示例。创建后可逐项替换。
            </p>
            {(selectionError || error) && (
              <p role='alert' className='text-sm text-destructive'>
                {selectionError || error}
              </p>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={handleCancel}
              disabled={loading}
            >
              取消
            </Button>
            <Button type='submit' disabled={loading}>
              {loading ? '创建中...' : retrying ? '重试创建' : '创建简历'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
