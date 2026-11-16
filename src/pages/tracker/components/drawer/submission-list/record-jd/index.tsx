import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import SubmissionJd from '../../submission-jd'

export function RecordJd({ recordId }: { recordId: string }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (!next) triggerRef.current?.focus({ preventScroll: true })

        setOpen(next)
      }}
    >
      <CollapsibleTrigger asChild>
        <Button
          ref={triggerRef}
          size='sm'
          variant='ghost'
          className='group text-muted-foreground focus-visible:ring-inset'
        >
          <ChevronDown
            aria-hidden
            className='transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none'
            style={{ transitionDuration: `${reduce ? 0 : DURATION.fast}s` }}
          />
          记录时保存的 JD
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        inert={!open}
        aria-hidden={!open || undefined}
        className='motion-reduce:animate-none'
      >
        <div className='pt-2'>
          <SubmissionJd
            recordId={recordId}
            enabled={open}
            onRetry={() => triggerRef.current?.focus({ preventScroll: true })}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
