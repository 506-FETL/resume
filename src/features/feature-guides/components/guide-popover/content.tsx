import { ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GuideController } from '../../types'

export default function GuideContent({ guide }: { guide: GuideController }) {
  const { step, index, count, busy, next, close } = guide
  const hint = index === 0

  const dismiss = (
    <Button
      type='button'
      variant='ghost'
      size='icon-xs'
      aria-label='关闭引导，不再提示'
      onClick={close}
      className='shrink-0 text-muted-foreground'
    >
      <X className='size-3.5' />
    </Button>
  )

  if (hint)
    return (
      <div className='flex items-center gap-1'>
        <div className='min-w-0 px-1.5'>
          <h2 className='text-xs font-medium leading-5'>
            {step.hint ?? step.title}
          </h2>
          {step.hintDetail && (
            <p className='text-[11px] leading-4 text-muted-foreground'>
              {step.hintDetail}
            </p>
          )}
        </div>
        {count > 1 && (
          <Button
            data-feature-guide-next
            type='button'
            variant='ghost'
            size='xs'
            onClick={next}
            disabled={busy}
            aria-busy={busy}
            className='px-1.5 text-xs text-muted-foreground'
          >
            看看
          </Button>
        )}
        {dismiss}
      </div>
    )

  return (
    <>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-[13px] font-medium leading-5'>{step.title}</h2>
        {dismiss}
      </div>
      <p className='text-xs leading-5 text-muted-foreground' aria-live='polite'>
        {step.description}
      </p>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-[11px] tabular-nums text-muted-foreground'>
          {!step.terminal && `${index} / ${count - 1}`}
        </span>
        <Button
          data-feature-guide-next
          type='button'
          variant='secondary'
          size='xs'
          disabled={busy}
          aria-busy={busy}
          onClick={next}
          className='h-7 gap-1.5 px-2 text-xs'
        >
          {busy
            ? '演示中…'
            : (step.nextLabel ?? (index === count - 1 ? '完成' : '下一步'))}
          {!busy && <ArrowRight className='size-3' />}
        </Button>
      </div>
    </>
  )
}
