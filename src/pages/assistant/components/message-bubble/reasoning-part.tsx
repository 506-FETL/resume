import { Brain } from 'lucide-react'
import { memo, useState } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { TextPart } from './text-part'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

export const ReasoningPart = memo(function ReasoningPart({
  text,
  streaming = false,
}: ReasoningPartProps) {
  const [open, setOpen] = useState<boolean>()

  return (
    <Trace>
      <TraceCollapsible open={open ?? streaming} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={streaming ? 'running' : undefined}>
            <TraceIcon>
              <Brain />
            </TraceIcon>
            <TraceTitle>
              <AnimatedContent
                as='span'
                className='inline-block'
                animationKey={streaming ? 'running' : 'done'}
              >
                {streaming ? '正在思考' : '查看思考过程'}
              </AnimatedContent>
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className='text-sm'>
          <TextPart text={text} animate={streaming} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
})
