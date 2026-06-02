import type { VariantChange } from '@/lib/schema'
import { parseLlmJsonObject } from '@/lib/llm'
import { variantChangeSchema } from '@/lib/schema'
import { MAX_CHANGES, MIN_CHANGES, REWRITE_AFTER_LENGTH_RATIO } from '../const'

interface RawShape {
  changes?: unknown
}

export interface ParseVariantResult {
  changes: VariantChange[]
}

export function parseVariantResponse(raw: string, options: { strict: boolean }): ParseVariantResult {
  let obj: RawShape | null = null
  try {
    obj = parseLlmJsonObject<RawShape>(raw)
  }
  catch (err) {
    if (options.strict) {
      throw err
    }
    return { changes: [] }
  }
  const list = Array.isArray(obj?.changes) ? obj.changes : []
  const valid: VariantChange[] = []
  for (const item of list) {
    const parsed = variantChangeSchema.safeParse(item)
    if (!parsed.success) {
      continue
    }
    const c = parsed.data
    if (c.before === c.after) {
      continue
    }
    if (c.after.length > c.before.length * REWRITE_AFTER_LENGTH_RATIO) {
      continue
    }
    if (c.matchedKeywords.length === 0) {
      continue
    }
    valid.push(c)
    if (valid.length >= MAX_CHANGES) {
      break
    }
  }
  if (options.strict && valid.length < MIN_CHANGES) {
    throw new Error('AI 改写无效，请重试')
  }
  return { changes: valid }
}
