import type { PersistedResumeSnapshot, VariantChange } from '@/lib/schema'
import { parseLlmJsonObject } from '@/lib/llm'
import { parseCompletedJsonArrayItems } from '@/lib/llm/partial-json'
import { variantChangeSchema } from '@/lib/schema'
import { MAX_CHANGES, MIN_CHANGES, REWRITE_AFTER_LENGTH_RATIO } from '../const'
import { applyVariantChange } from './apply-changes'

interface RawShape {
  changes?: unknown
}

export interface ParseVariantResult {
  changes: VariantChange[]
}

export function parseVariantResponse(
  raw: string,
  options: { strict: boolean, snapshot?: PersistedResumeSnapshot },
): ParseVariantResult {
  const changes = options.strict
    ? parseLlmJsonObject<RawShape>(raw).changes
    : parseCompletedJsonArrayItems(raw, 'changes')
  const list = Array.isArray(changes) ? changes : []
  const valid: VariantChange[] = []
  for (const item of list) {
    const parsed = variantChangeSchema.safeParse(item)
    if (!parsed.success) {
      if (options.strict) {
        throw new Error(`AI 改写格式或路径无效：${parsed.error.issues[0]?.message ?? '未知错误'}`)
      }
      continue
    }
    const c = parsed.data
    if (options.strict && options.snapshot) {
      // 过滤无变化/长度超限之前验证目标和原文，避免把失配输出当作成功过滤掉。
      applyVariantChange(options.snapshot, { ...c, after: c.before })
    }
    if (c.before === c.after) {
      continue
    }
    if (c.after.length > c.before.length * REWRITE_AFTER_LENGTH_RATIO) {
      continue
    }
    if (c.matchedKeywords.length === 0) {
      continue
    }
    if (valid.length < MAX_CHANGES) {
      valid.push(c)
    }
  }
  if (options.strict && valid.length < MIN_CHANGES) {
    throw new Error('AI 改写无效，请重试')
  }
  return { changes: valid }
}
