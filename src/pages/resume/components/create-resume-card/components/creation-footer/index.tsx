import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { RefObject } from 'react'
import type { useCreationFlow } from '../../hooks/use-creation-flow'
import { useCreationDraftStore } from '../../store'
import type { CreationStep } from '../../types'
import { importReady } from '../../utils'

export function CreationFooter({
  step,
  go,
  headingRef,
  flow,
  detailsFormId,
  isOnline,
}: {
  step: CreationStep
  go: (next: CreationStep) => void
  headingRef: RefObject<HTMLHeadingElement | null>
  flow: ReturnType<typeof useCreationFlow>
  detailsFormId: string
  isOnline: boolean
}) {
  const draft = useCreationDraftStore((state) => state.draft)
  const saving = useCreationDraftStore((state) => state.saving)
  const busy = flow.creating || flow.reading
  const templateWorkspace = step === 'template' || step === 'details'

  const storageMode =
    draft.creation?.mode ?? draft.creationMode ?? (isOnline ? 'cloud' : 'local')

  if (step === 'choose') return null

  return (
    <div className='flex shrink-0 items-center justify-between gap-2 border-t pt-3'>
      <Button
        size='sm'
        variant='ghost'
        disabled={busy}
        onClick={() =>
          go(
            draft.creation
              ? 'choose'
              : step === 'details'
                ? 'template'
                : step === 'template'
                  ? draft.contentSource === 'template'
                    ? 'choose'
                    : draft.contentSource === 'profile'
                      ? 'profile'
                      : 'review'
                  : step === 'review'
                    ? 'import'
                    : 'choose',
          )
        }
      >
        <ArrowLeft className='size-4' />
        返回
      </Button>
      <div className='flex min-w-0 flex-1 items-center justify-end gap-3'>
        {templateWorkspace && (
          <span className='max-w-44 truncate text-xs text-muted-foreground'>
            {draft.selectedTemplate?.name ??
              draft.creation?.selection?.name ??
              '请选择模板'}{' '}
            · {storageMode === 'cloud' ? '云端' : '本地'}
          </span>
        )}
        {step === 'review' && (
          <Button
            disabled={busy || !importReady(draft)}
            onClick={() => go('template')}
          >
            选择模板
            <ArrowRight className='size-4' />
          </Button>
        )}
        {step === 'profile' && (
          <Button
            disabled={busy || Boolean(draft.creation)}
            onClick={() => {
              headingRef.current?.focus()
              flow.prepareProfile()
            }}
          >
            选择模板
            <ArrowRight className='size-4' />
          </Button>
        )}
        {step === 'template' && (
          <Button
            disabled={busy || !draft.selectedTemplate}
            onClick={() => go('details')}
          >
            下一步
            <ArrowRight className='size-4' />
          </Button>
        )}
        {step === 'details' && (
          <Button
            type='submit'
            form={detailsFormId}
            disabled={busy || (!draft.selectedTemplate && !draft.creation)}
          >
            {flow.creating
              ? '正在创建…'
              : draft.creation
                ? '重试创建'
                : '创建简历'}
          </Button>
        )}
        {step === 'import' && saving && (
          <span role='status' className='text-xs text-muted-foreground'>
            保存中…
          </span>
        )}
      </div>
    </div>
  )
}
