export const EXPERIENCE_EXTRACTOR_VERSION = 1

export const EXPERIENCE_MAX_BYTES = 10 * 1024 * 1024

export const EXPERIENCE_MAX_TEXT = 60000

export const EXPERIENCE_MAX_BLOCK_TEXT = 2400

export const EXPERIENCE_MAX_BLOCKS = 30000

export type ExperienceSourceKind =
  | 'pdf'
  | 'docx'
  | 'text'
  | 'markdown'
  | 'paste'
  | 'image'
  | 'spreadsheet'

export type ExperienceSourceStatus =
  | 'uploading'
  | 'upload-failed'
  | 'ready'
  | 'deleting'
  | 'delete-failed'

export interface ExperienceSourceBlock {
  id: string
  text: string
  start: number
  end: number
  page?: number
}

export interface ExperienceSourceReference {
  sourceId: string
  versionId: string
  name: string
}

export interface ExperienceSourceRelation extends ExperienceSourceReference {
  currentVersionId: string | null
  updatedAt: string
}

export interface ExperienceSource {
  id: string
  name: string
  kind: ExperienceSourceKind
  status: ExperienceSourceStatus
  currentVersionId: string | null
  previewText: string
  createdAt: string
  updatedAt: string
}

export type ExperienceSourceMetadata = Pick<
  ExperienceSource,
  'id' | 'name' | 'status' | 'currentVersionId' | 'updatedAt'
>

export interface ExtractedExperienceFile {
  text: string
  sourceName: string
  kind: ExperienceSourceKind
  blocks: ExperienceSourceBlock[]
  extractorVersion: number
}

export interface ExperienceSourceVersion {
  id: string
  sourceId: string
  sourceName: string
  contentHash: string
  fileName: string | null
  fileMime: string | null
  fileSize: number | null
  extractorVersion: number
  textLength: number
  blockCount: number
  createdAt: string
}

export interface ExperienceSaveResult {
  source: ExperienceSource
  versionId: string
  reused: boolean
}

export interface ExperienceSourceReadResult {
  source: ExperienceSource
  version: ExperienceSourceVersion
  blocks: ExperienceSourceBlock[]
  hasMore: boolean
}

export interface ExperienceSearchMatch extends ExperienceSourceReference {
  block: ExperienceSourceBlock
  context: ExperienceSourceBlock[]
}

export interface ExperienceOperation {
  operationId: string
  requestHash: string
  status: 'pending' | 'ready' | 'failed'
  result: ExperienceSaveResult | null
}

export async function hashExperienceBytes(data: BufferSource): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))

  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hashExperienceRequest(input: {
  sourceId?: string
  name: string
  contentHash: string
  extracted: ExtractedExperienceFile
}): Promise<string> {
  const { sourceId, name, contentHash, extracted } = input

  const canonical = {
    sourceId: sourceId ?? null,
    name: name.trim(),
    contentHash,
    extracted: {
      text: extracted.text,
      kind: extracted.kind,
      sourceName: extracted.sourceName,
      extractorVersion: extracted.extractorVersion,
      blocks: extracted.blocks.map(({ id, text, start, end, page }) => ({
        id,
        text,
        start,
        end,
        ...(page ? { page } : {}),
      })),
    },
  }

  return hashExperienceBytes(
    new TextEncoder().encode(JSON.stringify(canonical)).buffer,
  )
}
