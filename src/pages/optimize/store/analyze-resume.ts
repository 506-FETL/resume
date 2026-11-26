import type { AnalysisState, AtsLlmDraft } from '../types'
import {
  buildAtsAssessmentInput,
  normalizeAtsEvaluationResult,
} from '@/lib/ats'
import { parseLlmJsonObject, runAtsStructured } from '@/lib/llm'
import { createAtsConfig } from '@/lib/supabase/resume/ats'
import { buildAtsCreatePayload } from '@/lib/supabase/resume/utils'
import type { AtsResumeLabel } from '@/lib/supabase/resume/ats'
import {
  fetchResumeDataForAnalysis,
  mapDocToResumeSchema,
} from '../utils/resume-data'

interface AnalysisRequest {
  id: string
  owner: string
  offline: boolean
  isCurrent: () => boolean
  selectUploaded: (label: AtsResumeLabel) => void
  progress: (
    partial: Partial<AnalysisState>,
    logs?: Record<string, string>,
  ) => void
}

export async function analyzeResume({
  id,
  owner,
  offline,
  isCurrent,
  selectUploaded,
  progress,
}: AnalysisRequest) {
  let resumeId = id
  let resume

  if (offline) {
    const [{ getOfflineResumeById }, { uploadOfflineResumeToCloud }] =
      await Promise.all([
        import('@/lib/offline-resume-manager'),
        import('@/lib/supabase/resume/form'),
      ])

    const local = await getOfflineResumeById(id)

    if (!isCurrent()) return
    if (!local) throw new Error('本地简历不存在')

    const cloud = await uploadOfflineResumeToCloud(
      local.data,
      {
        display_name: local.display_name,
        description: '从本地上传的简历',
      },
      'default',
      { forAnalysis: true, expectedOwner: owner },
    )

    if (!isCurrent()) return

    resumeId = cloud.resume_id
    resume = mapDocToResumeSchema(cloud)

    selectUploaded({
      resume_id: cloud.resume_id,
      display_name: cloud.display_name,
      updated_at: cloud.updated_at,
    })

    progress(
      { status: 'fetching' },
      { upload: '上传成功', fetch: '已取得云端保存的简历' },
    )
  } else {
    resume = await fetchResumeDataForAnalysis(id, false)
  }

  if (!isCurrent()) return

  const assessment = buildAtsAssessmentInput(resume)

  progress({ status: 'sending' }, { send: '正在提交检测…' })

  const { content } = await runAtsStructured(
    assessment,
    ({ content, reasoning }) => {
      if (!isCurrent()) return

      progress(
        {
          status: content ? 'generating' : 'thinking',
          content: content ?? '',
          reasoning: reasoning ?? '',
        },
        reasoning ? { send: '已提交，正在分析…' } : undefined,
      )
    },
  )

  if (!isCurrent()) return

  const result = normalizeAtsEvaluationResult(
    parseLlmJsonObject<AtsLlmDraft>(content),
    assessment,
  )

  progress(
    { status: 'saving' },
    { result: '已收到结果', save: '正在保存分析报告…' },
  )

  return createAtsConfig(buildAtsCreatePayload(result, resumeId))
}
