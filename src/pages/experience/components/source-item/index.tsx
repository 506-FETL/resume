import { AnimatePresence } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { CONTENT_SWITCH } from '@/lib/motion'
import type { ExperienceSource } from '@/lib/experience-sources/types'
import {
  formatSourceDate,
  STATUS_LABEL,
} from '@/features/experience-sources/utils'
import { cn } from '@/lib/utils'
import { EXPERIENCE_SOURCE_APPEARANCE } from '../../const'
import { useExperiencePageStore } from '../../store'
import type { ExperienceView } from '../../types'

export default function SourceItem({
  source,
  view,
  disabled,
  onOpen,
}: {
  source: ExperienceSource
  view: ExperienceView
  disabled: boolean
  onOpen: () => void
}) {
  const appearance = EXPERIENCE_SOURCE_APPEARANCE[source.kind]
  const Icon = appearance.icon
  const status = source.status !== 'ready' ? STATUS_LABEL[source.status] : null

  const { selectionMode, selectedSources, toggleSource, requestDelete } =
    useExperiencePageStore()

  const reduced = useReducedMotion()
  const selected = selectedSources.some((item) => item.id === source.id)

  const label = selectionMode
    ? `${selected ? '取消选择' : '选择'}${source.name}`
    : `打开${source.name}`

  const activate = () => (selectionMode ? toggleSource(source) : onOpen())

  const action = (
    <div
      className={cn(
        'absolute right-3 flex size-9 items-center justify-center',
        view === 'grid' ? 'top-4' : 'top-1/2 -translate-y-1/2',
      )}
    >
      <AnimatePresence mode='wait' initial={false}>
        <PresenceDiv
          key={selectionMode ? 'select' : 'delete'}
          className='flex size-9 items-center justify-center'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: {
              ...CONTENT_SWITCH.exit,
              duration: reduced ? 0 : CONTENT_SWITCH.exit.duration,
            },
          }}
          transition={{
            ...CONTENT_SWITCH.enter,
            duration: reduced ? 0 : CONTENT_SWITCH.enter.duration,
          }}
        >
          {selectionMode ? (
            <Checkbox
              checked={selected}
              disabled={disabled}
              aria-label={`选择${source.name}`}
              onCheckedChange={() => toggleSource(source)}
            />
          ) : (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={disabled}
              aria-label={`删除${source.name}`}
              className='text-muted-foreground hover:text-destructive'
              onClick={() => requestDelete([source])}
            >
              <Trash2 />
            </Button>
          )}
        </PresenceDiv>
      </AnimatePresence>
    </div>
  )

  if (view === 'list')
    return (
      <Item
        className={cn(
          'relative min-w-0 gap-0 rounded-lg p-0 transition-colors duration-(--ui-motion-fast)',
          selected && selectionMode && 'bg-muted',
        )}
      >
        <Button
          type='button'
          variant='ghost'
          disabled={disabled}
          data-source-id={source.id}
          aria-label={label}
          aria-pressed={selectionMode ? selected : undefined}
          onClick={activate}
          className='h-auto min-w-0 w-full whitespace-normal flex-nowrap items-center justify-start gap-3 rounded-[inherit] px-3 py-3 pr-14 text-left font-normal'
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              appearance.className,
            )}
          >
            <Icon className='size-4' aria-hidden />
          </span>
          <ItemContent className='min-w-0'>
            <ItemTitle className='w-full min-w-0 max-w-full text-base'>
              <span className='line-clamp-2 w-full min-w-0 break-words'>
                {source.name}
              </span>
            </ItemTitle>
            <p className='line-clamp-1 break-words text-sm text-muted-foreground'>
              {source.previewText.slice(0, 160)}
            </p>
            <p className='text-xs text-muted-foreground'>
              {appearance.label} · {formatSourceDate(source.updatedAt)}
              {status ? ` · ${status}` : ''}
            </p>
          </ItemContent>
        </Button>
        {action}
      </Item>
    )

  return (
    <Card
      className={cn(
        'relative h-full min-w-0 gap-0 p-0 shadow-none ring-border/80 transition-[background-color,box-shadow] duration-(--ui-motion-fast)',
        selected && selectionMode && 'bg-muted ring-primary/60',
      )}
    >
      <Button
        type='button'
        variant='ghost'
        disabled={disabled}
        data-source-id={source.id}
        aria-label={label}
        aria-pressed={selectionMode ? selected : undefined}
        onClick={activate}
        className='h-full min-h-56 w-full flex-col items-stretch justify-start gap-3 rounded-[inherit] p-4 whitespace-normal text-left font-normal'
      >
        <div className='flex items-center gap-2.5 pr-10'>
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              appearance.className,
            )}
          >
            <Icon className='size-5' aria-hidden />
          </span>
          <span className='text-xs font-medium text-muted-foreground'>
            {appearance.label}
          </span>
        </div>
        <CardTitle className='line-clamp-2 min-w-0 max-w-full break-words text-base leading-6 font-semibold'>
          {source.name}
        </CardTitle>
        <p className='line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground'>
          {source.previewText.slice(0, 160) ||
            (status
              ? '资料尚未准备完成。'
              : source.kind === 'image'
                ? '打开查看图片原件，可放大或下载。'
                : '打开查看保存的原文。')}
        </p>
        <div className='mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1 text-xs leading-5 text-muted-foreground'>
          <time dateTime={source.updatedAt}>
            {formatSourceDate(source.updatedAt)}
          </time>
          {status && (
            <span
              className={
                source.status.includes('failed')
                  ? 'text-destructive'
                  : undefined
              }
            >
              {status}
            </span>
          )}
        </div>
      </Button>
      {action}
    </Card>
  )
}
