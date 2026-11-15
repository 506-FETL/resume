import {
  hashExperienceBytes,
  hashExperienceRequest,
} from '../../../supabase/functions/shared/experience-source-contract'
import type {
  ExtractedExperienceFile,
  ExperienceOperation,
  ExperienceSaveResult,
  ExperienceSearchMatch,
  ExperienceSource,
  ExperienceSourceMetadata,
  ExperienceSourceReadResult,
  ExperienceSourceReference,
  ExperienceSourceRelation,
} from './types'
import { ExperienceSourceError } from './types'
import supabase from '../supabase/client'
import { getDatabaseFunctionUrl } from '../supabase/edge-functions'

type ReadOptions = {
  sourceId: string
  versionId?: string
  signal?: AbortSignal
}

type RelationTarget = {
  target: 'conversation' | 'resume'
  targetId: string
  signal?: AbortSignal
}

async function request<T>(
  input: Record<string, unknown>,
  options: { file?: File; signal?: AbortSignal; download?: boolean } = {},
): Promise<T> {
  const { data, error } = await supabase.auth.getSession()
  const session = data.session

  options.signal?.throwIfAborted()

  if (error || !session)
    throw new ExperienceSourceError('请先登录后使用职业档案。', 'unauthorized')

  const form = new FormData()

  form.set('input', JSON.stringify(input))

  if (options.file) form.set('file', options.file)

  let response: Response

  try {
    response = await fetch(getDatabaseFunctionUrl('experience-sources'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: form,
      signal: options.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError')
      throw cause

    throw new ExperienceSourceError(
      '请求结果暂未确认，请重试。',
      'network',
      'unknown',
    )
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null)

    throw new ExperienceSourceError(
      detail?.error ?? '职业档案暂时无法读取，请稍后重试。',
      detail?.code ?? 'unavailable',
      response.status >= 500 ? 'unknown' : 'rejected',
    )
  }

  try {
    return (await (options.download ? response.blob() : response.json())) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error

    throw new ExperienceSourceError(
      '请求结果暂未确认，请重试。',
      'network',
      'unknown',
    )
  }
}

export function listExperienceSources(
  options: {
    query?: string
    kind?: 'files' | 'paste'
    offset?: number
    limit?: number
    signal?: AbortSignal
  } = {},
): Promise<{ items: ExperienceSource[]; total: number; hasMore: boolean }> {
  const { signal, ...input } = options

  return request({ action: 'list', ...input }, { signal })
}

export function getExperienceOperation(
  operationId: string,
  signal?: AbortSignal,
): Promise<ExperienceOperation | null> {
  return request({ action: 'operation', operationId }, { signal })
}

export async function saveExperienceSource(options: {
  operationId: string
  sourceId?: string
  name: string
  extracted: ExtractedExperienceFile
  file?: File
  signal?: AbortSignal
}): Promise<ExperienceSaveResult> {
  const { file, signal, ...input } = options

  const [previous, bytes] = await Promise.all([
    getExperienceOperation(input.operationId, signal),
    file
      ? file.arrayBuffer()
      : Promise.resolve(new TextEncoder().encode(input.extracted.text).buffer),
  ])

  const contentHash = await hashExperienceBytes(bytes)
  const requestHash = await hashExperienceRequest({ ...input, contentHash })

  if (previous && requestHash !== previous.requestHash)
    throw new ExperienceSourceError(
      '本次操作内容已改变，请重新发起保存。',
      'operation_conflict',
    )
  if (previous?.status === 'ready' && previous.result) return previous.result

  try {
    return await request({ action: 'save', ...input }, { file, signal })
  } catch (error) {
    if (
      !(error instanceof ExperienceSourceError) ||
      error.outcome !== 'unknown'
    )
      throw error

    const operation = await getExperienceOperation(
      input.operationId,
      signal,
    ).catch(() => null)

    if (operation && requestHash !== operation.requestHash)
      throw new ExperienceSourceError(
        '本次操作内容已改变，请重新发起保存。',
        'operation_conflict',
      )
    if (operation?.status === 'ready' && operation.result)
      return operation.result

    throw new ExperienceSourceError(
      '保存结果暂未确认，请保留本次资料并重试。',
      'save_unknown',
      'unknown',
    )
  }
}

export function readExperienceSource(
  options: ReadOptions & {
    offset?: number
    limit?: number
    blockIds?: string[]
  },
): Promise<ExperienceSourceReadResult> {
  const { signal, ...input } = options

  return request({ action: 'read', ...input }, { signal })
}

export function downloadExperienceSource(options: ReadOptions): Promise<Blob> {
  const { signal, ...input } = options

  return request({ action: 'download', ...input }, { signal, download: true })
}

export function renameExperienceSource(
  sourceId: string,
  name: string,
  signal?: AbortSignal,
): Promise<ExperienceSource> {
  return request({ action: 'rename', sourceId, name }, { signal })
}

export async function deleteExperienceSource(
  sourceId: string,
  signal?: AbortSignal,
): Promise<void> {
  await request({ action: 'delete', sourceId }, { signal })
}

export function searchExperienceSources(options: {
  query: string
  sourceIds: string[]
  references?: Pick<ExperienceSourceReference, 'sourceId' | 'versionId'>[]
  limit?: number
  signal?: AbortSignal
}): Promise<{ matches: ExperienceSearchMatch[] }> {
  const { signal, ...input } = options

  return request({ action: 'search', ...input }, { signal })
}

export function getExperienceRelations(
  options: RelationTarget,
): Promise<ExperienceSourceRelation[]> {
  const { signal, ...input } = options

  return request({ action: 'relations', ...input }, { signal })
}

export function setExperienceRelations(
  options: RelationTarget & { references: ExperienceSourceReference[] },
): Promise<ExperienceSourceReference[]> {
  const { signal, ...input } = options

  return request({ action: 'set-relations', ...input }, { signal })
}

export function getExperienceSourceMetadata(
  sourceIds: string[],
  signal?: AbortSignal,
): Promise<{ items: ExperienceSourceMetadata[]; missingIds: string[] }> {
  if (!sourceIds.length) return Promise.resolve({ items: [], missingIds: [] })

  return request({ action: 'metadata', sourceIds }, { signal })
}
