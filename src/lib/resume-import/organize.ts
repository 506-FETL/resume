import type { ResumeParseResult } from './types'
import supabase from '@/lib/supabase/client'
import {
  normalizeImportLines,
  validateImportMapping,
  MAX_IMPORT_AI_CHARACTERS,
  MAX_IMPORT_AI_LINES,
} from '../../../supabase/functions/shared/resume-import-contract'
import { hasResumeContent, mergeImportMapping } from './mapping'
import { parseResumeText } from './parse'

export type ImportStage = 'reading' | 'organizing'

export function needsImportHelp(result: ResumeParseResult) {
  // Nonempty local fields do not establish correct semantic roles or grouping.
  // Use one cached, platform-funded classification for every nonempty import.
  return Boolean(
    result.unassignedText.trim() || hasResumeContent(result.content),
  )
}

export async function organizeResumeText(
  text: string,
  {
    signal,
    ownerId,
    onStage,
  }: {
    signal: AbortSignal
    ownerId: string | null
    onStage: (stage: ImportStage) => void
  },
): Promise<ResumeParseResult> {
  signal.throwIfAborted()

  const lines = normalizeImportLines(text)
  const normalized = lines.join('\n')
  const local = parseResumeText(normalized)

  // Warnings describe actual fallback reasons; unassigned text has its own UI.
  local.warnings = []

  if (!needsImportHelp(local)) return local
  if (!ownerId)
    return {
      ...local,
      warnings: ['已在本机填充；登录后导入可使用免费智能识别。'],
    }
  if (
    normalized.length > MAX_IMPORT_AI_CHARACTERS ||
    lines.length > MAX_IMPORT_AI_LINES
  ) {
    return { ...local, warnings: ['内容较长，已使用本机识别；原文完整保留。'] }
  }

  onStage('organizing')

  try {
    const { data } = await supabase.auth.getSession()

    signal.throwIfAborted()

    if (!data.session || data.session.user.id !== ownerId) return local

    // Separate free endpoint: never reserves or updates the user's AI quota.
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resume-import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text: normalized }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      },
    )

    const payload = await response.json()

    signal.throwIfAborted()

    if (
      response.ok &&
      payload.version === 1 &&
      validateImportMapping(payload.mapping, lines)
    ) {
      return mergeImportMapping(normalized, local, payload.mapping)
    }

    const warning =
      payload.error === 'rate_limited'
        ? '免费智能识别暂时达到使用上限，已保留本机填充结果。'
        : payload.error === 'processing'
          ? '这份内容仍在识别中，已先使用本机结果；稍后可重新导入。'
          : '智能识别暂时不可用，已保留本机填充结果。'

    return { ...local, warnings: [warning] }
  } catch {
    signal.throwIfAborted()

    return {
      ...local,
      warnings: ['智能识别未完成，已保留本机填充结果，可继续编辑。'],
    }
  }
}
