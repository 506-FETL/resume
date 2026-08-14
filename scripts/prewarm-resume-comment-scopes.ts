import { createClient } from '@supabase/supabase-js'
import { buildCommentAnchorDocument } from '../supabase/functions/shared/resume-comment-core.ts'

interface PrewarmSummary {
  scanned: number
  created: number
  skipped: number
  failed: number
}

interface ResumeVersionRow {
  id: number
  user_id: string
  snapshot: unknown
  projection_reference_date: string
}

const PAGE_SIZE = 100

function readRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function errorCategory(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name.replace(/[^a-zA-Z0-9_-]/gu, '_')
  }
  return 'unknown_error'
}

async function main() {
  const supabaseUrl = readRequiredEnvironment('SUPABASE_URL')
  const serviceRoleKey = readRequiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const summary: PrewarmSummary = { scanned: 0, created: 0, skipped: 0, failed: 0 }
  let lastVersionId = 0

  while (true) {
    const { data, error } = await admin
      .from('resume_config_versions')
      .select('id, user_id, snapshot, projection_reference_date, active_scopes:resume_comment_scopes!left(id)')
      .eq('status', 'active')
      .gt('id', lastVersionId)
      .eq('active_scopes.kind', 'version')
      .is('active_scopes.archived_at', null)
      .is('active_scopes', null)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE)

    if (error) {
      throw new Error('Unable to query versions missing an active comment scope')
    }
    const rows = (data ?? []) as ResumeVersionRow[]
    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      summary.scanned += 1
      try {
        const projected = buildCommentAnchorDocument(row.snapshot, row.projection_reference_date)
        const { data: scopeId, error: ensureError } = await admin.rpc(
          'ensure_resume_version_comment_scope',
          {
            p_owner_user_id: row.user_id,
            p_version_id: row.id,
            p_anchor_document: projected.document,
            p_document_hash: projected.documentHash,
            p_projection_reference_date: row.projection_reference_date,
          },
        )
        if (ensureError) {
          summary.failed += 1
          console.error(`prewarm_error:${errorCategory(ensureError)}`)
        }
        else if (scopeId) {
          summary.created += 1
        }
        else {
          summary.skipped += 1
        }
      }
      catch (error) {
        summary.failed += 1
        console.error(`prewarm_error:${errorCategory(error)}`)
      }
    }

    if (rows.length < PAGE_SIZE) {
      break
    }
    lastVersionId = rows[rows.length - 1]!.id
  }

  console.log(JSON.stringify(summary))
  if (summary.failed > 0) {
    process.exitCode = 1
  }
}

void main().catch((error: unknown) => {
  console.error(`prewarm_error:${errorCategory(error)}`)
  process.exitCode = 1
})
