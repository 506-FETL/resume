import type { SourceOperation } from '../types'
import { useRef } from 'react'

import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

import { Spinner } from '@/components/ui/spinner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useExperiencePageStore } from '../../../store'

export function DeleteSourceDialog({
  sourceId,
  open,
  onOpenChange,
  operation,
}: {
  sourceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  operation: SourceOperation
}) {
  const { busy, error, perform } = operation
  const deletedRef = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()
  const reduced = useReducedMotion()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={reduced ? { animationDuration: '0s' } : undefined}
        onCloseAutoFocus={(event) => {
          if (!deletedRef.current) return

          event.preventDefault()

          document
            .querySelector<HTMLButtonElement>('[data-experience-upload]')
            ?.focus({ preventScroll: true })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>删除这份资料？</AlertDialogTitle>
          <AlertDialogDescription>
            原件、提取文字与全部版本将被删除，后续无法继续引用。已发送的聊天文字仍会保留，需要清除时请另行删除对应对话。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button
            variant='destructive'
            disabled={busy}
            onClick={() => {
              perform(async () => {
                const generation =
                  useExperienceSourcesStore.getState().generation

                await useExperienceSourcesStore.getState().remove(sourceId)

                if (
                  generation !== useExperienceSourcesStore.getState().generation
                )
                  return

                deletedRef.current = true
                onOpenChange(false)

                useExperiencePageStore.getState().closeDetail()

                if (
                  location.search ||
                  (location.state as { sourceId?: string } | null)?.sourceId
                )
                  navigate('/experience', { replace: true, state: null })

                useExperiencePageStore.setState({
                  sourceId: null,
                  blockId: undefined,
                  versionId: undefined,
                })

                toast.success('资料已删除')
              })
            }}
          >
            {busy && <Spinner />}
            {error ? '重试删除' : '删除资料'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
