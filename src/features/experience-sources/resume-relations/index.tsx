import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import {
  getExperienceRelations,
  setExperienceRelations,
} from '@/lib/experience-sources/api'
import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import supabase from '@/lib/supabase/client'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experienceError } from '../utils'

type ResumeOption = { resume_id: string; display_name: string | null }

export function ExperienceResumeRelations({
  open,
  onOpenChange,
  reference,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reference: ExperienceSourceReference
}) {
  const [options, setOptions] = useState<ResumeOption[]>([])
  const [targetId, setTargetId] = useState('')

  const [references, setReferences] = useState<
    ExperienceSourceReference[] | null
  >(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const ownerId = useExperienceSourcesStore((state) => state.ownerId)

  const linked = references?.some(
    (item) => item.sourceId === reference.sourceId,
  )

  useEffect(() => {
    if (!open || !ownerId) return

    let active = true

    setLoading(true)
    setError(null)

    supabase
      .from('resume_config')
      .select('resume_id,display_name')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .then(({ data, error: cause }) => {
        if (!active) return
        if (cause) {
          setError(cause.message)
          setLoading(false)

          return
        }

        setOptions(data ?? [])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, ownerId, attempt])

  useEffect(() => {
    if (!open || !targetId) return

    let active = true

    setReferences(null)
    setError(null)

    getExperienceRelations({ target: 'resume', targetId })
      .then((next) => {
        if (active) setReferences(next)
      })
      .catch((cause) => {
        if (active) setError(experienceError(cause))
      })

    return () => {
      active = false
    }
  }, [targetId, open, attempt])

  async function toggleRelation() {
    if (!references) return

    const generation = useExperienceSourcesStore.getState().generation

    setSaving(true)
    setError(null)

    try {
      const next = await setExperienceRelations({
        target: 'resume',
        targetId,
        references: linked
          ? references.filter((item) => item.sourceId !== reference.sourceId)
          : [...references, reference],
      })

      if (generation !== useExperienceSourcesStore.getState().generation) return

      setReferences(next)
    } catch (cause) {
      setError(experienceError(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader className='px-6 pt-6'>
        <ResponsiveDialogTitle>关联到简历</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          从这份简历开启的新对话可使用这些资料。其他协作者不会获得你的私密资料。
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className='space-y-3 px-6 py-4'>
        <Select
          value={targetId}
          onValueChange={setTargetId}
          disabled={loading || saving}
        >
          <SelectTrigger className='w-full' aria-label='选择关联简历'>
            <SelectValue
              placeholder={loading ? '正在读取简历' : '选择一份云端简历'}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.resume_id} value={option.resume_id}>
                {option.display_name || '未命名简历'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && !options.length && !error && (
          <p className='text-sm text-muted-foreground'>
            还没有云端简历，请先在「我的简历」中创建。
          </p>
        )}
        {targetId && !references && !error && (
          <p className='text-sm text-muted-foreground'>正在读取关联状态…</p>
        )}
        {references && (
          <p className='text-sm text-muted-foreground'>
            {linked
              ? '这份资料已关联到所选简历。'
              : '这份资料尚未关联到所选简历。'}
          </p>
        )}
        {error && (
          <div role='alert' className='space-y-2 text-sm text-destructive'>
            <p>{error}</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setAttempt((value) => value + 1)}
            >
              重试读取
            </Button>
          </div>
        )}
      </div>
      <ResponsiveDialogFooter>
        <Button variant='outline' onClick={() => onOpenChange(false)}>
          完成
        </Button>
        <Button
          disabled={!references || saving || !!error}
          onClick={() => {
            toggleRelation()
          }}
        >
          {saving && <Spinner />}
          {linked ? '取消关联' : '关联这份资料'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  )
}
