import { Button } from '@/components/ui/button'
import { ArrowRight, FileText, Plus, Target, X } from 'lucide-react'
import type { RefObject } from 'react'
import { useCreationDraftStore } from '../../store'
import type { CreationStep } from '../../types'

export function CreationChoices({
  go,
  headingRef,
}: {
  go: (next: CreationStep) => void
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const draft = useCreationDraftStore((state) => state.draft)

  return (
    <div className='space-y-3 py-1'>
      {(draft.sourceText ||
        draft.content ||
        draft.selectedTemplate ||
        draft.creation) && (
        <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3'>
          <p className='text-sm'>
            {draft.creation
              ? '上次创建尚未确认'
              : draft.contentSource === 'profile' ||
                  draft.contentSource === 'template'
                ? '有一份未完成的简历'
                : '有一份导入草稿'}
          </p>
          <div className='flex items-center gap-1'>
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                go(
                  draft.creation || draft.selectedTemplate
                    ? 'details'
                    : draft.contentSource === 'profile'
                      ? 'template'
                      : draft.content
                        ? 'review'
                        : 'import',
                )
              }
            >
              {draft.creation ||
              draft.contentSource === 'profile' ||
              draft.contentSource === 'template'
                ? '继续创建'
                : '继续导入'}
            </Button>
            {(draft.sourceText || draft.content || draft.selectedTemplate) &&
              !draft.creation && (
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='清除草稿'
                  onClick={() => {
                    headingRef.current?.focus()

                    useCreationDraftStore
                      .getState()
                      .discard()
                      .catch(() => undefined)
                  }}
                >
                  <X className='size-4' />
                </Button>
              )}
          </div>
        </div>
      )}
      {[
        {
          step: 'import' as const,
          title: '我有旧简历',
          description: '导入 PDF、DOCX，或粘贴文字',
          icon: FileText,
        },
        {
          step: 'profile' as const,
          title: '从零整理经历',
          description: '选一份示例，改成自己的经历',
          icon: Plus,
        },
        {
          step: 'job' as const,
          title: '我有目标岗位',
          description: '选一份简历，按岗位要求调整',
          icon: Target,
        },
      ].map((item) => (
        <Button
          variant='outline'
          key={item.step}
          type='button'
          disabled={Boolean(draft.creation)}
          onClick={() => go(item.step)}
          className='h-auto w-full justify-start gap-3 rounded-lg p-4 text-left whitespace-normal shadow-none transition-colors hover:bg-accent/50 motion-reduce:transition-none'
        >
          <item.icon className='size-5 shrink-0 text-muted-foreground' />
          <span className='min-w-0 flex-1'>
            <span className='block font-medium'>{item.title}</span>
            <span className='mt-1 block text-xs text-muted-foreground'>
              {item.description}
            </span>
          </span>
          <ArrowRight className='size-4 text-muted-foreground' />
        </Button>
      ))}
    </div>
  )
}
