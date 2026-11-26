import type { ResumeSchema } from '@/lib/schema'
import type { JobDescriptionComparisonResult } from './types'
import { runJobDescriptionStructured, parseLlmJsonObject } from '@/lib/llm'
import useJobDescriptionToolStore from './store'
import { normalizeJobDescriptionComparisonResult } from './utils'

export async function compareJobDescription(
  sessionKey: string,
  resume: ResumeSchema,
  jobDescription: string,
  isCurrent: () => boolean,
) {
  const { content, reasoning } = await runJobDescriptionStructured(
    resume,
    jobDescription,
    ({ content, reasoning }) => {
      if (!isCurrent()) return

      useJobDescriptionToolStore.getState().update(
        sessionKey,
        {
          analysisState: {
            status: content ? 'generating' : 'thinking',
            content: content ?? '',
            reasoning: reasoning ?? '',
            logs: {
              send: '已提交，正在分析岗位匹配情况…',
              ...(content ? { result: '正在生成比对结果…' } : {}),
            },
          },
        },
        'stream',
      )
    },
  )

  if (!isCurrent()) return

  const parsed =
    parseLlmJsonObject<Partial<JobDescriptionComparisonResult>>(content)

  const comparison = normalizeJobDescriptionComparisonResult(parsed)

  return { content, reasoning, comparison }
}
