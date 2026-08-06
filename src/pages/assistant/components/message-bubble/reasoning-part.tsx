import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai/reasoning'
import { Shimmer } from '@/components/ai/shimmer'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

function getThinkingMessage(isStreaming: boolean, duration?: number) {
  if (isStreaming || duration === 0)
    return <Shimmer duration={1}>正在思考…</Shimmer>
  if (duration === undefined)
    return <span>已完成思考</span>
  return (
    <span>
      思考了
      {duration}
      {' '}
      秒
    </span>
  )
}

export function ReasoningPart({ text, streaming = false }: ReasoningPartProps) {
  return (
    <Reasoning isStreaming={streaming} defaultOpen={streaming} className="mb-1">
      <ReasoningTrigger getThinkingMessage={getThinkingMessage} />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
}
