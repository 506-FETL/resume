import { collectCheckFields } from '../targets'
import type { CheckSnapshot, CheckTarget, ResumeCheckIssue } from '../types'
import {
  ALLOWED_FIELDS,
  MAX_FIELDS,
  MAX_FIELD_LENGTH,
  MAX_INPUT_LENGTH,
  MAX_OUTPUT_LENGTH,
  REQUEST_TIMEOUT_MS,
  SYSTEM_PROMPT,
} from './contract'
import { ENGLISH_SPELLING_CORRECTIONS, KNOWN_TECHNICAL_TERMS } from './lexicon'
import { validateProofreadResponse } from './response'

/** 只发送可见的文字内容；日期、联系方式、公司/人名与配置不参与模型校对。 */
export function buildProofreadFields(snapshot: CheckSnapshot): CheckTarget[] {
  const fields = collectCheckFields(snapshot).filter((field) =>
    ALLOWED_FIELDS.has(field.path.split('/').at(-1) ?? ''),
  )

  if (
    fields.length > MAX_FIELDS ||
    fields.some((field) => field.quote.length > MAX_FIELD_LENGTH) ||
    JSON.stringify(fields).length > MAX_INPUT_LENGTH
  ) {
    throw new Error('简历文字较长，暂时无法一次完成 AI 校对，请先分段检查')
  }

  return fields
}

export async function proofreadResume(
  snapshot: CheckSnapshot,
  controller: AbortController,
): Promise<ResumeCheckIssue[]> {
  if (controller.signal.aborted)
    throw new DOMException('已取消校对', 'AbortError')

  const fields = buildProofreadFields(snapshot)

  if (!fields.length) return []

  const requestController = new AbortController()
  let timedOut = false
  let rejectAborted: (error: Error) => void = () => undefined

  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = reject
  })

  const abortRequest = () => {
    requestController.abort()

    rejectAborted(
      timedOut
        ? new Error('AI 校对超时，请稍后重试')
        : new DOMException('已取消校对', 'AbortError'),
    )
  }

  const timeout = setTimeout(() => {
    timedOut = true
    abortRequest()
  }, REQUEST_TIMEOUT_MS)

  controller.signal.addEventListener('abort', abortRequest, { once: true })

  const run = async () => {
    const { callLLM } = await import('../../llm/call')

    if (requestController.signal.aborted)
      throw new DOMException('已取消校对', 'AbortError')

    const stream = await callLLM(
      {
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              dataType: 'untrusted_resume_text',
              allowedTechnicalTerms: [...KNOWN_TECHNICAL_TERMS],
              allowedEnglishCorrections: [...ENGLISH_SPELLING_CORRECTIONS],
              fields: fields.map(({ section, path, quote }) => ({
                section,
                path,
                text: quote,
              })),
            }),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 4096,
        stream: true,
      },
      requestController,
    )

    let content = ''
    let finishReason: string | null = null

    for await (const chunk of stream) {
      if (requestController.signal.aborted)
        throw new DOMException('已取消校对', 'AbortError')

      const choice = chunk.choices[0]

      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (typeof choice?.delta.content === 'string')
        content += choice.delta.content

      if (content.length > MAX_OUTPUT_LENGTH) {
        requestController.abort()

        throw new Error('AI 校对结果过长，请重试')
      }
    }

    if (requestController.signal.aborted)
      throw new DOMException('已取消校对', 'AbortError')
    if (finishReason === 'length') throw new Error('AI 校对结果被截断，请重试')
    if (finishReason !== 'stop') throw new Error('AI 校对中断，请重试')

    return validateProofreadResponse(snapshot, fields, content)
  }

  try {
    return await Promise.race([run(), aborted])
  } finally {
    clearTimeout(timeout)
    controller.signal.removeEventListener('abort', abortRequest)
  }
}
