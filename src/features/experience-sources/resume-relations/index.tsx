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
import { useResumeOptions } from './use-resume-options'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experienceError } from '../utils'

export function ExperienceResumeRelations({
  open,
  returnFocusTo,
  onOpenChange,
  reference,
}: {
  open: boolean
  returnFocusTo?: HTMLElement | null
  onOpenChange: (open: boolean) => void
  reference: ExperienceSourceReference
}) {
  const [targetId, setTargetId] = useState('')

  const [references, setReferences] = useState<
    ExperienceSourceReference[] | null
  >(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const ownerId = useExperienceSourcesStore((state) => state.ownerId)

  const {
    options,
    hasMore,
    loading,
    error: optionsError,
    loadMore,
    retry,
  } = useResumeOptions(open, ownerId)

  const linked = references?.some(
    (item) => item.sourceId === reference.sourceId,
  )

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
    <ResponsiveDialog
      returnFocusTo={returnFocusTo}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ResponsiveDialogHeader className='px-6 pt-6'>
        <ResponsiveDialogTitle>关联到简历</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          从这份简历开启的新对话可使用这些资料。其他协作者不会获得你的私密资料。
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className='space-y-3 px-6 py-4'>
        <Select
          value={targetId}
          onValueChange={(id) => {
            setReferences(null)
            setTargetId(id)
          }}
          disabled={!options.length || saving}
        >
          <SelectTrigger className='w-full' aria-label='选择关联简历'>
            <SelectValue
              placeholder={
                loading && !options.length ? '正在读取简历' : '选择一份云端简历'
              }
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
        {optionsError ? (
          <div role='alert' className='flex items-center gap-2 text-sm'>
            {optionsError}
            <Button variant='outline' size='sm' onClick={retry}>
              重试读取简历
            </Button>
          </div>
        ) : (
          hasMore && (
            <Button
              variant='outline'
              size='sm'
              disabled={loading || saving}
              onClick={loadMore}
            >
              {loading ? '正在读取简历' : '加载更多简历'}
            </Button>
          )
        )}
        {!loading && !options.length && !optionsError && (
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
