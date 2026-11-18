import type { CitationEvidence } from '@/lib/ai/agent/citation-evidence'

export interface TextPartProps {
  text: string
  animate?: boolean
  evidence?: CitationEvidence[]
}
