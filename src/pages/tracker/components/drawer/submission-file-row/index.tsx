import { useRef } from 'react'
import { ChevronRight, FileText, MoreHorizontal, Pencil } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DURATION } from '@/lib/motion'
import type { JobSubmission } from '../../../submission-types'

export default function SubmissionFileRow({
  record,
  onPreview,
  onCorrect,
}: {
  record: JobSubmission
  onPreview: () => void
  onCorrect?: () => void
}) {
  const reduce = useReducedMotion()
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const correctRequestedRef = useRef(false)

  const name =
    record.material_kind === 'platform'
      ? '平台简历 · 固定版本'
      : record.file_name

  return (
    <div className='flex min-w-0 items-center gap-1 rounded-lg border bg-muted/20 p-1'>
      <Button
        variant='ghost'
        className='h-auto min-h-12 min-w-0 flex-1 justify-start gap-3 px-2 py-2 text-left whitespace-normal focus-visible:ring-inset'
        onClick={onPreview}
      >
        <FileText aria-hidden className='size-5 text-muted-foreground' />
        <span className='min-w-0 flex-1 space-y-0.5'>
          <span className='block break-all text-sm'>{name}</span>
          <span className='block text-xs font-normal text-muted-foreground'>
            投递原件 ·{' '}
            {record.material_kind === 'platform'
              ? '查看固定版本'
              : record.file_mime === 'application/pdf'
                ? '预览 PDF'
                : '下载 DOCX'}
          </span>
        </span>
        <ChevronRight aria-hidden className='size-4 text-muted-foreground' />
      </Button>
      {onCorrect && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTriggerRef}
                  size='icon-sm'
                  variant='ghost'
                  aria-label='投递原件操作'
                  className='focus-visible:ring-inset'
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent className='motion-reduce:animate-none'>
              更多操作
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align='end'
            className='motion-reduce:animate-none'
            style={{ animationDuration: `${reduce ? 0 : DURATION.fast}s` }}
            onCloseAutoFocus={(event) => {
              if (!correctRequestedRef.current) return

              event.preventDefault()
              correctRequestedRef.current = false
              menuTriggerRef.current?.focus({ preventScroll: true })
              onCorrect()
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                correctRequestedRef.current = true
              }}
            >
              <Pencil aria-hidden />
              更正原件
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
