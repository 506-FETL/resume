import type { SourceOperation } from '../types'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'

import type { ExperienceSource } from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'

export function RenameSourceDialog({
  sourceId,
  sourceName,
  open,
  onOpenChange,
  operation,
  onRenamed,
}: {
  sourceId: string
  sourceName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  operation: SourceOperation
  onRenamed: (source: ExperienceSource) => void
}) {
  const [name, setName] = useState(sourceName)
  const { busy, error, perform } = operation

  useEffect(() => {
    if (open) {
      setName(sourceName)
    }
  }, [open, sourceName])

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader className='px-6 pt-6'>
        <ResponsiveDialogTitle>重命名资料</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          更改资料库名称，保留原文与历史版本。
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className='space-y-3 px-6 py-4'>
        <Input
          aria-label='资料名称'
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
        />
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
      </div>
      <ResponsiveDialogFooter>
        <Button variant='outline' onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          disabled={busy || !name.trim()}
          onClick={() => {
            perform(async () => {
              const generation = useExperienceSourcesStore.getState().generation

              const updatedSource = await useExperienceSourcesStore
                .getState()
                .rename(sourceId, name.trim().slice(0, 160))

              if (
                generation !== useExperienceSourcesStore.getState().generation
              )
                return

              onRenamed(updatedSource)

              onOpenChange(false)
            })
          }}
        >
          {busy && <Spinner />}保存名称
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  )
}
