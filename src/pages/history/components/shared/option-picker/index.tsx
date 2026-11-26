import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import type { OptionWindow } from '../../../store/option-window'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContentSkeleton } from '@/components/loading-skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { useHistoryMotion } from '../../../hooks/use-history-motion'

interface Props<Row> {
  id?: string
  label: string
  value: string | null
  trigger: ReactNode
  data: OptionWindow<Row>
  onOpen: () => void
  onMore: () => void
  onChange: (id: string) => void
  itemId: (row: Row) => string
  itemLabel: (row: Row) => string
  renderItem?: (row: Row) => ReactNode
  triggerClassName?: string
  emptyLabel: string
  noneLabel?: string
}

export default function HistoryOptionPicker<Row>({
  id,
  label,
  value,
  trigger,
  data,
  onOpen,
  onMore,
  onChange,
  itemId,
  itemLabel,
  renderItem,
  noneLabel,
  triggerClassName,
  emptyLabel,
}: Props<Row>) {
  const [open, setOpen] = useState(false)
  const { surfaceProps } = useHistoryMotion()
  const retry = data.ready ? onMore : onOpen
  const firstNewRef = useRef<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !data.ready && !data.loading && !data.error) onOpen()
  }, [open, data.ready, data.loading, data.error, onOpen])

  useEffect(() => {
    const offset = firstNewRef.current

    if (!open || offset === null || data.loading) return

    const id = data.items[offset] && itemId(data.items[offset])

    if (id)
      contentRef.current
        ?.querySelector<HTMLElement>(`[data-option-id="${CSS.escape(id)}"]`)
        ?.focus()

    firstNewRef.current = null
  }, [data.items, data.loading, itemId, open])

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)

        if (next) onOpen()
        else firstNewRef.current = null
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          aria-label={label}
          className={cn(
            'w-full min-w-0 justify-between bg-background text-left shadow-none',
            triggerClassName,
          )}
        >
          <span className='flex min-w-0 items-center gap-2 truncate'>
            {trigger}
          </span>
          <ChevronDown
            aria-hidden
            className='size-4 shrink-0 text-muted-foreground'
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        {...surfaceProps}
        align='start'
        className={`${surfaceProps.className} history-popup-motion scrollbar-thin-subtle max-h-80 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto`}
      >
        <OptionRows
          items={data.items}
          value={value}
          onChange={onChange}
          itemId={itemId}
          itemLabel={itemLabel}
          renderItem={renderItem}
          noneLabel={noneLabel}
        />
        {data.error ? (
          <>
            <p role='alert' className='px-2 py-1 text-xs text-destructive'>
              {data.error}
            </p>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                retry()
              }}
            >
              重试
            </DropdownMenuItem>
          </>
        ) : data.loading || !data.ready ? (
          <ContentSkeleton label={`正在加载${label}`} rows={2} />
        ) : data.hasMore ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              firstNewRef.current = data.items.length
              onMore()
            }}
          >
            加载更多
          </DropdownMenuItem>
        ) : !data.items.length ? (
          <p role='status' className='px-2 py-2 text-sm text-muted-foreground'>
            {emptyLabel}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OptionRows<Row>({
  items,
  value,
  onChange,
  itemId,
  itemLabel,
  renderItem,
  noneLabel,
}: Pick<
  Props<Row>,
  'value' | 'onChange' | 'itemId' | 'itemLabel' | 'renderItem' | 'noneLabel'
> & { items: readonly Row[] }) {
  return (
    <DropdownMenuRadioGroup value={value ?? ''} onValueChange={onChange}>
      {noneLabel && (
        <DropdownMenuRadioItem value=''>{noneLabel}</DropdownMenuRadioItem>
      )}
      {items.map((row) => {
        const id = itemId(row)
        const label = itemLabel(row)

        return (
          <DropdownMenuRadioItem
            key={id}
            value={id}
            textValue={label}
            data-option-id={id}
          >
            {renderItem ? renderItem(row) : label}
          </DropdownMenuRadioItem>
        )
      })}
    </DropdownMenuRadioGroup>
  )
}
