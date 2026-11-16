import type {
  ExperienceSource,
  ExperienceSourceBlock,
} from '../shared/experience-source-contract.ts'

export const SOURCE_FIELDS =
  'id,conversation_id,name,kind,status,current_version_id,preview_text,created_at,updated_at'

export const VERSION_FIELDS =
  'id,source_id,source_name,content_hash,file_name,file_mime,file_size,extractor_version,text_length,block_count,created_at'

export const BLOCK_FIELDS = 'block_id,text,start_offset,end_offset,page'

export type VersionRow = {
  id: string
  source_id: string
  source_name: string
  content_hash: string
  object_key: string | null
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  extractor_version: number
  text_length: number
  block_count: number
  created_at: string
}

export type SourceRow = {
  id: string
  conversation_id: string | null
  name: string
  kind: ExperienceSource['kind']
  status: ExperienceSource['status']
  current_version_id: string | null
  preview_text: string
  created_at: string
  updated_at: string
}

export function sourceResult(row: SourceRow): ExperienceSource {
  return {
    id: row.id,
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    name: row.name,
    kind: row.kind,
    status: row.status,
    currentVersionId: row.current_version_id,
    previewText: row.preview_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function blockResult(row: {
  block_id: string
  text: string
  start_offset: number
  end_offset: number
  page: number | null
}): ExperienceSourceBlock {
  return {
    id: row.block_id,
    text: row.text,
    start: row.start_offset,
    end: row.end_offset,
    ...(row.page ? { page: row.page } : {}),
  }
}
