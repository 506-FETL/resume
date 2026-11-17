import type {
  ExtractedExperienceFile,
  ExperienceSourceReference,
} from '../shared/experience-source-contract.ts'
import {
  EXPERIENCE_MAX_BLOCKS,
  EXPERIENCE_MAX_BLOCK_TEXT,
  EXPERIENCE_MAX_TEXT,
  EXPERIENCE_EXTRACTOR_VERSION,
} from '../shared/experience-source-contract.ts'

export class ExperienceRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export type ExperienceInput =
  | { action: 'metadata'; sourceIds: string[] }
  | {
      action: 'list'
      query: string
      kind?: 'files' | 'paste'
      offset: number
      limit: number
    }
  | { action: 'operation'; operationId: string }
  | {
      action: 'save'
      operationId: string
      sourceId?: string
      conversationId?: string
      name: string
      extracted: ExtractedExperienceFile
    }
  | {
      action: 'read'
      sourceId: string
      versionId?: string
      offset: number
      limit: number
      blockIds?: string[]
    }
  | { action: 'download'; sourceId: string; versionId?: string }
  | { action: 'text'; sourceId: string; versionId: string }
  | { action: 'rename'; sourceId: string; name: string }
  | { action: 'delete'; sourceId: string }
  | { action: 'delete-conversation'; conversationId: string }
  | {
      action: 'search'
      query: string
      sourceIds: string[]
      references?: ExperienceSourceReference[]
      limit: number
    }
  | { action: 'relations'; target: 'conversation' | 'resume'; targetId: string }
  | {
      action: 'set-relations'
      target: 'conversation' | 'resume'
      targetId: string
      references: ExperienceSourceReference[]
    }

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function invalid(message = '请求内容无效。'): never {
  throw new ExperienceRequestError('invalid_request', message)
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()

  return value as Record<string, unknown>
}

function string(value: unknown, max: number, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  )
    invalid()

  return value
}

function uuid(value: unknown): string {
  const result = string(value, 36)

  if (!UUID.test(result)) invalid('资料或目标编号无效。')

  return result
}

function integer(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback
  if (
    !Number.isInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  )
    invalid()

  return value as number
}

function references(value: unknown): ExperienceSourceReference[] {
  if (!Array.isArray(value) || value.length > 200) invalid()

  const result = value.map((entry) => {
    const row = object(entry)

    return {
      sourceId: uuid(row.sourceId),
      versionId: uuid(row.versionId),
      name: row.name === undefined ? '资料' : string(row.name, 160),
    }
  })

  if (new Set(result.map((entry) => entry.sourceId)).size !== result.length)
    invalid()

  return result
}

function extracted(value: unknown): ExtractedExperienceFile {
  const row = object(value)
  const kind = string(row.kind, 16)

  const text = string(
    row.text,
    EXPERIENCE_MAX_TEXT,
    kind === 'image' || kind === 'file',
  )

  if (text.includes('\0')) invalid('文字包含无法保存的字符，请重新粘贴纯文本。')

  if (
    ![
      'file',
      'pdf',
      'docx',
      'text',
      'markdown',
      'paste',
      'image',
      'spreadsheet',
    ].includes(kind)
  )
    invalid()
  if (row.extractorVersion !== EXPERIENCE_EXTRACTOR_VERSION)
    invalid('请刷新页面后重新读取文件。')
  if (
    !Array.isArray(row.blocks) ||
    (!['image', 'file'].includes(kind) && !row.blocks.length) ||
    row.blocks.length > EXPERIENCE_MAX_BLOCKS
  )
    invalid()

  if (
    ['image', 'file'].includes(kind) &&
    (text !== '' || row.blocks.length !== 0)
  )
    invalid('文件仅保存原件，不能附带提取文字。')

  let previousEnd = 0
  const ids = new Set<string>()

  const blocks = row.blocks.map((entry) => {
    const block = object(entry)
    const id = string(block.id, 80)
    const content = string(block.text, EXPERIENCE_MAX_BLOCK_TEXT)
    const start = integer(block.start, -1, 0, text.length)
    const end = integer(block.end, -1, 1, text.length)

    if (
      start < previousEnd ||
      end <= start ||
      text.slice(start, end) !== content ||
      ids.has(id)
    )
      invalid('提取段落无法对应原文，请重新读取文件。')
    if (text.slice(previousEnd, start).trim())
      invalid('提取段落遗漏了原文，请重新读取文件。')

    let page: number | undefined

    if (kind === 'pdf') page = integer(block.page, -1, 1, 30)
    else if (block.page !== undefined) invalid()

    if (page === -1) invalid('PDF 段落缺少真实页码。')

    previousEnd = end
    ids.add(id)

    return { id, text: content, start, end, ...(page ? { page } : {}) }
  })

  if (text.slice(previousEnd).trim())
    invalid('提取段落遗漏了原文，请重新读取文件。')

  return {
    text,
    kind: kind as ExtractedExperienceFile['kind'],
    sourceName: string(row.sourceName, 255),
    extractorVersion: EXPERIENCE_EXTRACTOR_VERSION,
    blocks,
  }
}

export function parseExperienceInput(value: unknown): ExperienceInput {
  const input = object(value)
  const action = input.action

  switch (action) {
    case 'list': {
      if (
        input.kind !== undefined &&
        input.kind !== 'files' &&
        input.kind !== 'paste'
      )
        throw new ExperienceRequestError(
          'invalid_kind',
          '请选择文件或粘贴文字。',
        )

      return {
        action,
        query: string(input.query ?? '', 200, true).trim(),
        kind: input.kind,
        offset: integer(input.offset, 0, 0, 1000000),
        limit: integer(input.limit, 10, 1, 10),
      }
    }

    case 'metadata': {
      if (!Array.isArray(input.sourceIds) || input.sourceIds.length > 100)
        invalid()

      return { action, sourceIds: [...new Set(input.sourceIds.map(uuid))] }
    }

    case 'operation':
      return { action, operationId: uuid(input.operationId) }
    case 'save':
      return {
        action,
        operationId: uuid(input.operationId),
        ...(input.sourceId === undefined
          ? {}
          : { sourceId: uuid(input.sourceId) }),
        ...(input.conversationId === undefined
          ? {}
          : { conversationId: uuid(input.conversationId) }),
        name: string(input.name, 160).trim(),
        extracted: extracted(input.extracted),
      }
    case 'read': {
      let blockIds: string[] | undefined

      if (input.blockIds !== undefined) {
        if (!Array.isArray(input.blockIds) || input.blockIds.length > 20)
          invalid()

        blockIds = input.blockIds.map((id) => string(id, 80))
      }

      return {
        action,
        sourceId: uuid(input.sourceId),
        ...(input.versionId === undefined
          ? {}
          : { versionId: uuid(input.versionId) }),
        offset: blockIds
          ? 0
          : integer(input.offset, 0, 0, EXPERIENCE_MAX_BLOCKS),
        limit: blockIds ? 20 : integer(input.limit, 20, 1, 20),
        ...(blockIds ? { blockIds } : {}),
      }
    }

    case 'text':
      return {
        action,
        sourceId: uuid(input.sourceId),
        versionId: uuid(input.versionId),
      }
    case 'download':
      return {
        action,
        sourceId: uuid(input.sourceId),
        ...(input.versionId === undefined
          ? {}
          : { versionId: uuid(input.versionId) }),
      }
    case 'rename':
      return {
        action,
        sourceId: uuid(input.sourceId),
        name: string(input.name, 160).trim(),
      }
    case 'delete':
      return { action, sourceId: uuid(input.sourceId) }
    case 'delete-conversation':
      return { action, conversationId: uuid(input.conversationId) }
    case 'search': {
      if (!Array.isArray(input.sourceIds) || input.sourceIds.length > 200)
        invalid()

      const sourceIds = input.sourceIds.map(uuid)

      const selected =
        input.references === undefined
          ? undefined
          : references(input.references)

      if (selected?.some((ref) => !sourceIds.includes(ref.sourceId)))
        invalid('检索资料超出了本次选择范围。')

      return {
        action,
        sourceIds,
        query: string(input.query, 200).trim(),
        limit: integer(input.limit, 12, 1, 20),
        ...(selected ? { references: selected } : {}),
      }
    }

    case 'relations':
    case 'set-relations': {
      if (input.target !== 'conversation' && input.target !== 'resume')
        invalid()

      const target = input.target
      const targetId = uuid(input.targetId)

      return action === 'relations'
        ? { action, target, targetId }
        : { action, target, targetId, references: references(input.references) }
    }

    default:
      return invalid()
  }
}
