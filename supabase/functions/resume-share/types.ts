import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'

export interface GetResult {
  needPassword?: boolean
  source_kind?: 'current' | 'history'
  content_revision?: string
  not_modified?: boolean
  snapshot?: unknown
  template_manifest?: unknown
  display_name?: string | null
  share_id?: string
  release_id?: string
  release_no?: number
  version_id?: number
  document_revision?: number
  allow_comments?: boolean
  projection_reference_date?: string
  comment_scope_id?: string
  comment_access_token?: string
  comment_access_expires_at?: string
  error?: string
}

export interface CurrentReleaseRow {
  id: string
  release_no: number
  display_name: string | null
  created_at: string
}

export interface SavedShareSettings {
  current_release_id: string | null
  version_id: number | null
  allow_comments: boolean
}

export type AdminClient = SupabaseClient

export type ShareJson = (
  body: unknown,
  status?: number,
  metricErrorCode?: string,
) => Response
