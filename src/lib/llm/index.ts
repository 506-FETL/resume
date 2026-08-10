import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import type { ResumeSchema } from '../schema'
import type { RewriteRequestArgs } from '@/components/ai-rewrite/types'
import type { EditableResumeView } from '@/components/jd-variant/types'
import { throttle } from 'lodash'
import { REWRITE_TEMPERATURE } from '@/components/ai-rewrite/const'
import { callLLM } from './call'
import { buildJdParsePrompt, buildJdRewritePrompt, JD_VARIANT_PARSE_TEMPERATURE, JD_VARIANT_REWRITE_TEMPERATURE } from './prompts/jd-variant'
import { createJobDescriptionAnalysisPrompt } from './prompts/job-description'
import { optimize_prompt } from './prompts/optimize'
import { buildRewritePrompt } from './prompts/rewrite'

interface StreamUpdate {
  content?: string
  reasoning?: string
}

async function streamStructuredJson(
  req: ChatCompletionCreateParamsBase,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const { throttleMs = 100, abortController } = options || {}
  const stream = await callLLM(req, abortController)

  let fullContent = ''
  let fullReasoning = ''
  let finishReason: string | null = null

  const throttledUpdate = onUpdate
    ? throttle((data: StreamUpdate) => {
        onUpdate(data)
      }, throttleMs)
    : null

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
    const delta = choice?.delta as { content?: string, reasoning_content?: string } | undefined
    // finish_reason 权威区分：'length'=被截断（超出 token 预算）、'stop'=正常结束、null=流被中断
    const chunkFinish = (choice as { finish_reason?: string | null } | undefined)?.finish_reason
    if (chunkFinish)
      finishReason = chunkFinish
    const content = typeof delta?.content === 'string' ? delta.content : ''
    const reasoning = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : ''

    if (!content && !reasoning) {
      continue
    }

    if (content) {
      fullContent += content
    }

    if (reasoning) {
      fullReasoning += reasoning
    }

    throttledUpdate?.({
      content: fullContent,
      reasoning: fullReasoning,
    })
  }

  throttledUpdate?.flush()

  return { content: fullContent, reasoning: fullReasoning, finishReason }
}

// JSON 修复：大模型输出 HTML/文本字段时常见两类破坏——字符串内未转义的双引号、字符串内的裸控制字符
// （换行/制表符）。标准 JSON.parse 对此直接抛错。这里用一个「字符串感知」状态机逐字符扫描：
// - 处于字符串内遇到 " 时，向后跳过空白看下一个有效字符：若是 :,}] 或结尾 → 视为合法闭合引号；
//   否则视为字符串内的游离引号 → 补转义为 \"。
// - 字符串内的裸换行/回车/制表符 → 转义；其余控制字符丢弃。
// - 非字符串区遇到 , 且其后（跳空白）紧邻 } 或 ] → 删除尾逗号。
// 仅在标准解析失败后兜底调用，不改变语义。
function repairJsonText(text: string): string {
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '')
  const out: string[] = []
  let inString = false
  let escaped = false

  const nextMeaningfulChar = (from: number): string => {
    for (let j = from; j < cleaned.length; j++) {
      const c = cleaned[j]
      if (c !== ' ' && c !== '\n' && c !== '\r' && c !== '\t')
        return c
    }
    return ''
  }

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaped) {
        out.push(ch)
        escaped = false
        continue
      }
      if (ch === '\\') {
        out.push(ch)
        escaped = true
        continue
      }
      if (ch === '"') {
        const next = nextMeaningfulChar(i + 1)
        if (next === '' || next === ',' || next === '}' || next === ']' || next === ':') {
          out.push('"')
          inString = false
        }
        else {
          // 字符串内的游离引号 → 补转义
          out.push('\\"')
        }
        continue
      }
      if (ch === '\n') {
        out.push('\\n')
        continue
      }
      if (ch === '\r') {
        out.push('\\r')
        continue
      }
      if (ch === '\t') {
        out.push('\\t')
        continue
      }
      // 丢弃其余不可见控制字符
      if (ch.charCodeAt(0) < 0x20) {
        continue
      }
      out.push(ch)
      continue
    }

    // 非字符串区
    if (ch === '"') {
      out.push('"')
      inString = true
      continue
    }
    if (ch === ',') {
      const next = nextMeaningfulChar(i + 1)
      if (next === '}' || next === ']')
        continue // 删除尾逗号
    }
    out.push(ch)
  }

  return out.join('')
}

export function parseLlmJsonObject<T>(value: string): T {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  const firstBraceIndex = normalized.indexOf('{')
  const lastBraceIndex = normalized.lastIndexOf('}')

  if (firstBraceIndex < 0 || lastBraceIndex <= firstBraceIndex) {
    throw new Error('LLM 未返回有效的 JSON 对象')
  }

  const jsonText = normalized.slice(firstBraceIndex, lastBraceIndex + 1)

  // 先原样解析，失败再用状态机修复后重试。
  let lastError: unknown
  for (const candidate of [jsonText, repairJsonText(jsonText)]) {
    try {
      const parsed = JSON.parse(candidate)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('LLM 返回的 JSON 结构无效')
      return parsed as T
    }
    catch (error) {
      lastError = error
    }
  }

  // 两次都失败：打印错误位置附近的原文窗口，便于定位是「游离引号」还是「被截断」。
  const posMatch = /position (\d+)/.exec(String((lastError as Error)?.message))
  if (posMatch) {
    const pos = Number(posMatch[1])
    console.error(
      '[ATS JSON parse] 解析失败，错误位置附近原文：',
      JSON.stringify(jsonText.slice(Math.max(0, pos - 100), pos + 100)),
      `｜总长度=${jsonText.length}`,
    )
  }
  throw lastError instanceof Error ? lastError : new Error('LLM 返回的 JSON 无法解析')
}

export async function runAtsStructured(
  resumeConfig: ResumeSchema,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number },
) {
  const promptText = optimize_prompt.replace('<<<RESUME_JSON>>>', JSON.stringify(resumeConfig, null, 2))
  const req = {
    messages: [
      {
        role: 'system',
        content: `你是一个 ATS 简历评估引擎。你将收到一份用户上传的“简历 JSON”（字段固定，包含基本信息、求职意向、教育/工作/项目等）。你的任务是：仅根据该简历 JSON 的内容，生成一份「AtsEvaluationResult」评估结果 JSON。`,
      },
      { role: 'user', content: promptText },
    ],
    response_format: {
      type: 'json_object',
    },
    // ATS 结果 schema 很大，放宽 max_tokens 降低截断导致的 JSON 解析失败。
    max_tokens: 8192,
    // 关闭思考模式：ATS 是结构化 JSON 抽取任务，无需链式思考。
    // 开启时模型会先输出大量 reasoning_content，挤占 token 预算，导致「只返回思考过程」或正文被截断。
    // 关闭后整段预算都用于产出结果，同时缩短耗时。
    thinking: { type: 'disabled' },
    // 标记本次调用为 ATS 用途（服务端据系统提示词权威判定 cost，此字段仅作辅助/日志）。
    action: 'ats',
  } as ChatCompletionCreateParamsBase & { action?: string, thinking?: { type: string } }

  return await streamStructuredJson(req, onUpdate, options)
}

export async function runBulletRewrite(
  args: RewriteRequestArgs,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const promptText = buildRewritePrompt(args)
  const req = {
    messages: [
      {
        role: 'system',
        content: '你是一个简历内容改写引擎。你只输出严格符合契约的 JSON，禁止输出任何额外文本。',
      },
      { role: 'user', content: promptText },
    ],
    response_format: { type: 'json_object' },
    temperature: REWRITE_TEMPERATURE,
  } as ChatCompletionCreateParamsBase

  return await streamStructuredJson(req, onUpdate, options)
}

export async function runJobDescriptionStructured(
  resumeConfig: ResumeSchema,
  jobDescription: string,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number },
) {
  const promptText = createJobDescriptionAnalysisPrompt(JSON.stringify(resumeConfig, null, 2), jobDescription)
  const req = {
    messages: [
      {
        role: 'system',
        content: '你是一个职位描述匹配分析引擎。你会同时收到当前简历 JSON 和岗位描述文本。你的任务是只根据输入内容，输出一份严格符合约定结构的职位匹配分析 JSON。',
      },
      { role: 'user', content: promptText },
    ],
    response_format: {
      type: 'json_object',
    },
  } as ChatCompletionCreateParamsBase

  return await streamStructuredJson(req, onUpdate, options)
}

export async function runJdVariantParse(
  jdText: string,
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const { system, user } = buildJdParsePrompt(jdText)
  const req = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: JD_VARIANT_PARSE_TEMPERATURE,
  } as ChatCompletionCreateParamsBase
  return await streamStructuredJson(req, onUpdate, options)
}

export async function runJdVariantRewrite(
  args: { resumeJson: EditableResumeView, jdText: string, keywords: readonly string[] },
  onUpdate?: (data: StreamUpdate) => void,
  options?: { throttleMs?: number, abortController?: AbortController },
) {
  const { system, user } = buildJdRewritePrompt(args)
  const req = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: JD_VARIANT_REWRITE_TEMPERATURE,
  } as ChatCompletionCreateParamsBase
  return await streamStructuredJson(req, onUpdate, options)
}
