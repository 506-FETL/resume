import type { z } from 'zod'
import type { templateRefSchema } from './declarative/schema'
import type { TemplateDefinition } from './declarative/types'
import { templateDefinitionSchema } from './declarative/schema'
import {
  TEMPLATE_LIMITS,
  TemplateValidationError,
  validateTemplateDefinition,
} from './declarative/validate'

export {
  templateDefinitionSchema,
  templateIdSchema,
  templateRefSchema,
} from './declarative/schema'

export type * from './declarative/types'

export type TemplateRef = z.infer<typeof templateRefSchema>

export type TemplateErrorCode =
  | 'INVALID_BINDING'
  | 'INVALID_DEFINITION'
  | 'VERSION_NOT_FOUND'
  | 'UNSUPPORTED_CAPABILITY'
  | 'REFERENCE_MISMATCH'
  | 'LOAD_FAILED'
  | 'RESOURCE_LIMIT'

export class TemplateResolutionError extends Error {
  readonly code: TemplateErrorCode
  constructor(code: TemplateErrorCode, message: string) {
    super(message)
    this.name = 'TemplateResolutionError'
    this.code = code
  }
}

export function parseTemplateDefinition(input: unknown): TemplateDefinition {
  try {
    if (
      new TextEncoder().encode(JSON.stringify(input)).byteLength >
      TEMPLATE_LIMITS.definitionBytes
    )
      throw new TemplateResolutionError(
        'RESOURCE_LIMIT',
        '模板定义超过大小预算',
      )

    // 在 Zod 的递归之前检查深度，避免恶意 JSON 导致递归溢出。
    const queue: { value: unknown; depth: number }[] = [
      { value: input, depth: 0 },
    ]

    let visited = 0

    while (queue.length) {
      const { value, depth } = queue.pop()!

      if (++visited > 30000 || depth > 48)
        throw new TemplateResolutionError(
          'RESOURCE_LIMIT',
          '模板结构超过安全预算',
        )
      if (value && typeof value === 'object')
        Object.values(value).forEach((child) =>
          queue.push({ value: child, depth: depth + 1 }),
        )
    }

    const parsed = templateDefinitionSchema.safeParse(input)

    if (!parsed.success) {
      const unsupported = parsed.error.issues.some((issue) =>
        ['type', 'renderContract', 'schemaVersion'].includes(
          String(issue.path.at(-1)),
        ),
      )

      throw new TemplateResolutionError(
        unsupported ? 'UNSUPPORTED_CAPABILITY' : 'INVALID_DEFINITION',
        `模板配置无效：${parsed.error.issues[0]?.message ?? '未知错误'}`,
      )
    }

    validateTemplateDefinition(parsed.data)

    return parsed.data
  } catch (error) {
    if (error instanceof TemplateResolutionError) throw error
    if (error instanceof TemplateValidationError)
      throw new TemplateResolutionError(
        error.reason === 'limit'
          ? 'RESOURCE_LIMIT'
          : error.reason === 'capability'
            ? 'UNSUPPORTED_CAPABILITY'
            : 'INVALID_DEFINITION',
        error.message,
      )

    throw new TemplateResolutionError('INVALID_DEFINITION', '模板定义无法解析')
  }
}

export function asTemplateError(error: unknown): TemplateResolutionError {
  return error instanceof TemplateResolutionError
    ? error
    : new TemplateResolutionError('LOAD_FAILED', '模板资源加载失败，请重试')
}
