import { memo } from 'react'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai/reasoning'
import AnimatedContent from '@/components/motion/animated-content'
import { Shimmer } from '@/components/ai/shimmer'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

function getThinkingMessage(isStreaming: boolean, duration?: number) {
  const thinking = isStreaming || duration === 0
  const label = duration === undefined ? '已完成思考' : `思考了 ${duration} 秒`

  return (
    <AnimatedContent
      animationKey={thinking ? 'thinking' : 'complete'}
      className='inline-flex min-w-0'
    >
      {thinking ? (
        <Shimmer duration={1}>正在思考…</Shimmer>
      ) : (
        <span>{label}</span>
      )}
    </AnimatedContent>
  )
}

export const ReasoningPart = memo(function ReasoningPart({
  text,
  streaming = false,
}: ReasoningPartProps) {
  return (
    <Reasoning isStreaming={streaming} defaultOpen={false} className='mb-1'>
      <ReasoningTrigger getThinkingMessage={getThinkingMessage} />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
})
