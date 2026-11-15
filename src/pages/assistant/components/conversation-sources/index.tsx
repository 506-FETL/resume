import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import { Archive, ChevronDown, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ExperienceSourcePicker } from '@/features/experience-sources'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { setExperienceRelations } from '@/lib/experience-sources/api'
import { resolveActiveResumeId } from '@/lib/ai/active-resume'
import { getErrorMessage } from '@/utils'
import useUserStore from '@/store/user'
import { useSourceScope } from '../../hooks/use-source-scope'
import { loadLibraryScope } from '../../store/source-scope'
import useAssistantStore from '../../store'

export default function ConversationSources({
  inline = false,
}: {
  inline?: boolean
}) {
  const conversationId = useAssistantStore(
    (state) => state.activeConversationId,
  )

  const librarySources = useAssistantStore(
    (state) => state.composerLibrarySources,
  )

  const ownerId = useUserStore((state) => state.currentUser?.id)
  const scope = useSourceScope()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const reduced = useReducedMotion()

  const remove = async (
    target: 'conversation' | 'resume',
    sourceId: string,
  ) => {
    const targetId =
      target === 'conversation' ? conversationId : resolveActiveResumeId()

    if (!targetId || saving) return

    setSaving(`${target}:${sourceId}`)

    try {
      await setExperienceRelations({
        target,
        targetId,
        references: scope[target].filter(
          (source) => source.sourceId !== sourceId,
        ),
      })

      if (useUserStore.getState().currentUser?.id === ownerId)
        useAssistantStore.setState((state) => ({
          sourceScopeRevision: state.sourceScopeRevision + 1,
        }))
    } catch (cause) {
      toast.error('移除失败', { description: getErrorMessage(cause) })
    } finally {
      setSaving(null)
    }
  }

  const body = (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-xs text-muted-foreground'>
          选用的资料会在下一次发送时生效。
        </p>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          onClick={() => {
            setOpen(false)
            setPicking(true)
          }}
        >
          <Plus />
          添加
        </Button>
      </div>
      {!scope.sources && !scope.error && (
        <div role='status' aria-label='正在读取资料范围' className='space-y-2'>
          <Skeleton className='h-5 w-4/5' />
          <Skeleton className='h-5 w-3/5' />
        </div>
      )}
      {scope.error && (
        <div role='alert' className='space-y-2'>
          <p className='text-sm text-destructive'>{scope.error}</p>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={scope.retry}
          >
            重新加载
          </Button>
        </div>
      )}
      {scope.sources && (
        <div className='max-h-48 space-y-3 overflow-y-auto'>
          {(['conversation', 'resume'] as const).map(
            (target) =>
              scope[target].length > 0 && (
                <div key={target} className='space-y-1'>
                  <p className='text-xs text-muted-foreground'>
                    {target === 'conversation' ? '本对话选用' : '来自关联简历'}
                  </p>
                  {scope[target].map((source) => (
                    <div
                      key={source.sourceId}
                      className='flex min-w-0 items-center gap-1'
                    >
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='min-w-0 flex-1 justify-start'
                        onClick={() => {
                          setOpen(false)

                          useAssistantStore
                            .getState()
                            .openSourceViewer(source, anchorRef.current)
                        }}
                      >
                        <span className='truncate'>{source.name}</span>
                      </Button>
                      <Button
                        type='button'
                        size='icon-xs'
                        variant='ghost'
                        disabled={Boolean(saving)}
                        aria-label={`${target === 'conversation' ? '从本对话移除' : '取消简历关联'}${source.name}`}
                        onClick={() => remove(target, source.sourceId)}
                      >
                        {saving === `${target}:${source.sourceId}` ? (
                          <Spinner />
                        ) : (
                          <X />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ),
          )}
          {!scope.sources.length && (
            <p className='py-2 text-sm text-muted-foreground'>
              还没有选用资料，可以添加已有资料。
            </p>
          )}
        </div>
      )}
      {scope.resume.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          取消简历关联也会影响使用该简历的其他对话。
        </p>
      )}
      <div className='space-y-2'>
        <Button
          type='button'
          size='sm'
          variant={librarySources ? 'secondary' : 'outline'}
          disabled={Boolean(saving)}
          className='h-auto min-h-8 max-w-full whitespace-normal text-left'
          onClick={async () => {
            if (librarySources) {
              useAssistantStore.setState({ composerLibrarySources: null })

              return
            }

            setSaving('library')

            try {
              const sources = await loadLibraryScope()

              if (useUserStore.getState().currentUser?.id === ownerId)
                useAssistantStore.setState({ composerLibrarySources: sources })
            } catch (cause) {
              toast.error('资料库范围读取失败', {
                description: getErrorMessage(cause),
              })
            } finally {
              setSaving(null)
            }
          }}
        >
          {saving === 'library' && <Spinner />}
          {librarySources
            ? `本轮已选全部资料 · ${librarySources.length}，点击取消`
            : '本轮查找全部职业档案'}
        </Button>
        {librarySources && (
          <p className='text-xs text-muted-foreground'>
            仅用于下一条消息，不改变本对话已选资料。
          </p>
        )}
      </div>
    </div>
  )

  const label = `本对话资料 · ${scope.sources ? scope.sources.length : scope.error ? '读取失败' : '读取中'}`

  return (
    <>
      {inline ? (
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          className='mb-2 min-w-0'
        >
          <CollapsibleTrigger asChild>
            <Button
              type='button'
              ref={anchorRef}
              variant='ghost'
              size='sm'
              className='max-w-full gap-1 px-0 text-xs text-muted-foreground'
            >
              <Archive className='size-3.5' />
              {label}
              <ChevronDown className='size-3.5' />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent
            className='overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'
            style={reduced ? { animationDuration: '0s' } : undefined}
          >
            <div className='pb-2'>{body}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type='button'
              ref={anchorRef}
              variant='ghost'
              size='icon-sm'
              aria-label='本对话使用的职业档案'
            >
              <Archive />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align='end'
            className='w-[min(24rem,calc(100vw-2rem))]'
            style={reduced ? { animationDuration: '0s' } : undefined}
            onCloseAutoFocus={(event) => {
              if (useAssistantStore.getState().sourceViewer?.open)
                event.preventDefault()
            }}
          >
            {body}
          </PopoverContent>
        </Popover>
      )}
      <ExperienceSourcePicker
        open={picking}
        onOpenChange={setPicking}
        anchorRef={anchorRef}
        onSelect={(references: ExperienceSourceReference[]) => {
          useAssistantStore.getState().addComposerReferences(
            references.map((source) => ({
              type: 'reference',
              kind: 'experience',
              id: source.sourceId,
              versionId: source.versionId,
              label: source.name,
            })),
          )

          setPicking(false)

          requestAnimationFrame(() =>
            document
              .querySelector<HTMLTextAreaElement>('[data-composer] textarea')
              ?.focus({ preventScroll: true }),
          )
        }}
      />
    </>
  )
}
