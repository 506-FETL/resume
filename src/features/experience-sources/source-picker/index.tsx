import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Check, FileText, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog'
import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useSourceList } from '../use-source-list'
import { KIND_LABEL, sourceReference } from '../utils'
import { ExperienceUploadDialog } from '../upload-dialog'

export interface ExperienceSourcePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (references: ExperienceSourceReference[]) => void
  anchorRef?: RefObject<HTMLElement | null>
}

export function ExperienceSourcePicker(props: ExperienceSourcePickerProps) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return <SourcePickerContent key={generation} {...props} />
}

function SourcePickerContent({
  open,
  onOpenChange,
  onSelect,
  anchorRef,
}: ExperienceSourcePickerProps) {
  const isMobile = useIsMobile()
  const popover = !!anchorRef && !isMobile
  const selectedOnCloseRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<ExperienceSourceReference[]>([])
  const [upload, setUpload] = useState(false)
  const navigate = useNavigate()
  const { page, error, loading, retry } = useSourceList(search, offset, open)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query)
      setOffset(0)
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  function addReferences(references: ExperienceSourceReference[]) {
    setSelected((current) =>
      Array.from(
        new Map(
          [...current, ...references].map((reference) => [
            `${reference.sourceId}:${reference.versionId}`,
            reference,
          ]),
        ).values(),
      ),
    )
  }

  const Footer = popover ? 'div' : ResponsiveDialogFooter

  const content = (
    <>
      {popover ? (
        <div className='px-5 pt-5 pb-2'>
          <h2 id={titleId} className='font-semibold'>
            选择职业档案
          </h2>
          <p id={descriptionId} className='mt-1 text-sm text-muted-foreground'>
            选择要加入当前草稿的资料，加入后再告诉助手具体任务。
          </p>
        </div>
      ) : (
        <ResponsiveDialogHeader className='px-5 pt-5 pb-2'>
          <ResponsiveDialogTitle>选择职业档案</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            选择要加入当前草稿的资料，加入后再告诉助手具体任务。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
      )}
      <Command shouldFilter={false} className='min-h-0 rounded-none! px-3'>
        <CommandInput
          placeholder='搜索资料名称'
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className='max-h-[45dvh]'>
          {loading && !page ? (
            <div className='space-y-3 p-3'>
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className='h-12 w-full' />
              ))}
            </div>
          ) : null}
          {error ? (
            <div role='alert' className='p-3 text-sm'>
              <p>{error}</p>
              <Button size='sm' variant='outline' onClick={retry}>
                重新加载
              </Button>
            </div>
          ) : page?.items.length === 0 ? (
            <p className='p-5 text-center text-sm text-muted-foreground'>
              {search
                ? '没有找到同名资料'
                : '还没有职业档案，可以先上传或粘贴文字。'}
            </p>
          ) : (
            page?.items.map((source) => {
              const reference = sourceReference(source)

              const checked = selected.some(
                (item) =>
                  item.sourceId === source.id &&
                  item.versionId === source.currentVersionId,
              )

              return (
                <CommandItem
                  key={source.id}
                  value={source.id}
                  disabled={source.status !== 'ready' || !reference}
                  onSelect={() => {
                    if (!reference) return

                    setSelected((current) =>
                      checked
                        ? current.filter(
                            (item) =>
                              !(
                                item.sourceId === reference.sourceId &&
                                item.versionId === reference.versionId
                              ),
                          )
                        : [...current, reference],
                    )
                  }}
                  className='gap-3 py-3'
                >
                  <FileText />
                  <div className='min-w-0 flex-1'>
                    <p className='line-clamp-2 break-words'>{source.name}</p>
                    <p className='text-xs text-muted-foreground'>
                      {KIND_LABEL[source.kind]}
                      {source.status !== 'ready' ? ' · 暂不可用' : ''}
                    </p>
                  </div>
                  {checked && <Check aria-label='已选择' className='size-4' />}
                </CommandItem>
              )
            })
          )}
        </CommandList>
      </Command>
      {page && (offset > 0 || page.hasMore) && (
        <div className='flex items-center justify-between px-5'>
          <Button
            size='sm'
            variant='ghost'
            disabled={!offset}
            onClick={() => setOffset((value) => Math.max(0, value - 10))}
          >
            上一页
          </Button>
          <span className='text-xs text-muted-foreground'>
            {offset + 1}–{offset + page.items.length} / {page.total}
          </span>
          <Button
            size='sm'
            variant='ghost'
            disabled={!page.hasMore}
            onClick={() => setOffset((value) => value + 10)}
          >
            下一页
          </Button>
        </div>
      )}
      <div className='flex gap-2 px-5 pb-2'>
        <Button variant='ghost' size='sm' onClick={() => setUpload(true)}>
          <Upload />
          上传资料
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            onOpenChange(false)
            navigate('/experience')
          }}
        >
          管理资料
        </Button>
      </div>
      <Footer className='flex items-center justify-end gap-2 border-t px-5 py-4'>
        <Button variant='outline' onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          disabled={!selected.length}
          onClick={() => {
            selectedOnCloseRef.current = popover
            onSelect(selected)
            setSelected([])
            onOpenChange(false)
          }}
        >
          加入草稿{selected.length ? `（${selected.length}）` : ''}
        </Button>
      </Footer>
    </>
  )

  return (
    <>
      {popover ? (
        <Popover open={open && !upload} onOpenChange={onOpenChange}>
          <PopoverAnchor virtualRef={anchorRef as RefObject<HTMLElement>} />
          <PopoverContent
            align='start'
            side='top'
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className='max-h-[85dvh] w-[420px] max-w-[calc(100vw-2rem)] gap-2 overflow-hidden p-0'
            onCloseAutoFocus={(event) => {
              event.preventDefault()

              if (!selectedOnCloseRef.current)
                anchorRef.current?.focus({ preventScroll: true })

              selectedOnCloseRef.current = false
            }}
          >
            {content}
          </PopoverContent>
        </Popover>
      ) : (
        <ResponsiveDialog
          open={open && !upload}
          onOpenChange={onOpenChange}
          contentClassName='sm:max-w-[420px] max-h-[85dvh]'
        >
          {content}
        </ResponsiveDialog>
      )}
      <ExperienceUploadDialog
        open={upload}
        onOpenChange={(value) => setUpload(value)}
        onComplete={addReferences}
      />
    </>
  )
}
