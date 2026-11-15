import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import type { ExperienceSource } from '@/lib/experience-sources/types'
import {
  formatSourceDate,
  STATUS_LABEL,
} from '@/features/experience-sources/utils'
import { cn } from '@/lib/utils'
import { EXPERIENCE_SOURCE_APPEARANCE } from '../../const'
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

  if (view === 'list')
    return (
      <Item
        render={<Button type='button' variant='ghost' disabled={disabled} />}
        data-source-id={source.id}
        onClick={onOpen}
        className='h-auto w-full whitespace-normal flex-nowrap items-center gap-3 rounded-lg px-3 py-3 text-left font-normal'
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
      </Item>
    )

  return (
    <Card className='h-full gap-0 p-0 shadow-none ring-border/80'>
      <Button
        type='button'
        variant='ghost'
        disabled={disabled}
        data-source-id={source.id}
        onClick={onOpen}
        className='h-full min-h-56 w-full flex-col items-stretch justify-start gap-3 rounded-[inherit] p-4 whitespace-normal text-left font-normal'
      >
        <div className='flex items-center gap-2.5'>
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
    </Card>
  )
}
