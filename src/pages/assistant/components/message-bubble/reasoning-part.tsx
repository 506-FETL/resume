import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai/reasoning'

interface ReasoningPartProps {
  text: string
  streaming?: boolean
}

export function ReasoningPart({ text, streaming = false }: ReasoningPartProps) {
  return (
    <Reasoning isStreaming={streaming} defaultOpen={false} className="mb-1">
      <ReasoningTrigger />
      <ReasoningContent>{text}</ReasoningContent>
    </Reasoning>
  )
}
