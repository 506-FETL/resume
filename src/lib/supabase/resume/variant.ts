import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import supabase from '../client'
import { getCurrentUser } from '../user'

// TODO(Task 11): replace with `import { applyVariantChange } from '@/components/jd-variant/apply-changes'`.
// Stub: minimal field-path mutator covering top-level section assignment + ${section}.${itemId}.${fieldPath} bullet/field write.
// Until Task 11 lands, this stub gives `applyVariantChanges` enough behaviour so the data layer compiles + smoke-tests.
function applyVariantChange(snapshot: PersistedResumeSnapshot, _change: VariantChange): PersistedResumeSnapshot {
  // Conservative behaviour: do not mutate. Real implementation in Task 11 must do field-path replacement.
  // Return a shallow clone so callers see a "new" reference per change.
  return { ...snapshot }
}

export interface VariantTreeNode {
  resumeId: string
  displayName: string
  derivedStatus: DerivedStatus | null
  generatedAt: string | null
  jdSnippet: string | null
  matchRate: number | null
  children: VariantTreeNode[]
}

export interface VariantLineage {
  root: VariantTreeNode
  currentId: string
}

const MAX_VARIANT_TREE_DEPTH = 5

export async function cloneResumeAsDraft(args: {
  parent: PersistedResumeSnapshot & { resume_id: string, display_name?: string }
  jdText: string
  keywords: string[]
  summary?: string
}): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }

  const initialMetadata: VariantMetadata = {
    keywords: args.keywords,
    changes: [],
    generatedAt: new Date().toISOString(),
    matchRate: 0,
  }

  const cloneTitle = args.summary?.slice(0, 16) || args.keywords[0] || 'JD 变体'
  const display_name = `${args.parent.display_name ?? '简历'} - ${cloneTitle}`

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type: args.parent.type,
      basics: args.parent.basics ?? null,
      job_intent: args.parent.job_intent ?? null,
      application_info: args.parent.application_info ?? null,
      edu_background: args.parent.edu_background ?? null,
      work_experience: args.parent.work_experience ?? null,
      internship_experience: args.parent.internship_experience ?? null,
      campus_experience: args.parent.campus_experience ?? null,
      project_experience: args.parent.project_experience ?? null,
      skill_specialty: args.parent.skill_specialty ?? null,
      honors_certificates: args.parent.honors_certificates ?? null,
      self_evaluation: args.parent.self_evaluation ?? null,
      hobbies: args.parent.hobbies ?? null,
      order: args.parent.order ?? null,
      visibility: args.parent.visibility ?? null,
      spacing: args.parent.spacing,
      font: args.parent.font,
      theme: args.parent.theme,
      template_binding: args.parent.templateBinding ?? null,
      display_name,
      description: `JD 变体 · ${new Date().toLocaleDateString()}`,
      parent_resume_id: args.parent.resume_id,
      linked_jd_text: args.jdText,
      derived_metadata: initialMetadata,
      derived_status: 'generating',
    })
    .select('resume_id')
    .single()

  if (error) {
    throw error
  }
  return (data as { resume_id: string }).resume_id
}

// NOTE: until Task 11 replaces the inline `applyVariantChange` stub with the real field-path
// mutator, this function will write the section snapshots back unchanged. The DB round-trip
// still happens, so callers can rely on the returned snapshot reference, but no edits are
// actually applied. Replace the stub above to enable real mutation.
export async function applyVariantChanges(
  draftResumeId: string,
  snapshot: PersistedResumeSnapshot,
  changes: VariantChange[],
): Promise<PersistedResumeSnapshot> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }

  let next = snapshot
  for (const change of changes) {
    next = applyVariantChange(next, change)
  }

  const updates: Record<string, unknown> = {}
  for (const sec of new Set(changes.map(c => c.section))) {
    updates[sec as string] = (next as unknown as Record<string, unknown>)[sec as string]
  }

  const { error } = await supabase
    .from('resume_config')
    .update(updates)
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }
  return next
}

export async function markVariantReady(
  draftResumeId: string,
  args: { matchRate: number, generatedAt: string, changes?: VariantChange[], keywords?: string[] },
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data: existing, error: selectError } = await supabase
    .from('resume_config')
    .select('derived_metadata')
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
    .single()
  if (selectError) {
    throw selectError
  }
  const prior = (existing as { derived_metadata: VariantMetadata | null } | null)?.derived_metadata ?? null
  const next: VariantMetadata = {
    keywords: args.keywords ?? prior?.keywords ?? [],
    changes: args.changes ?? prior?.changes ?? [],
    matchRate: args.matchRate,
    generatedAt: args.generatedAt,
  }

  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'ready',
      derived_metadata: next,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) {
    throw error
  }
}

export async function markVariantFailed(draftResumeId: string, errorMessage: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }
  const { error } = await supabase
    .from('resume_config')
    .update({
      derived_status: 'failed',
      description: `派生失败：${errorMessage.slice(0, 200)}`,
    })
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) {
    throw error
  }
}

export async function deleteDraftVariant(draftResumeId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }
  const { error } = await supabase
    .from('resume_config')
    .delete()
    .eq('resume_id', draftResumeId)
    .eq('user_id', user.id)
  if (error) {
    throw error
  }
}

interface RawNode {
  resume_id: string
  parent_resume_id: string | null
  display_name: string | null
  derived_status: DerivedStatus | null
  derived_metadata: VariantMetadata | null
  linked_jd_text: string | null
}

function toTreeNode(row: RawNode): VariantTreeNode {
  return {
    resumeId: row.resume_id,
    displayName: row.display_name ?? '未命名简历',
    derivedStatus: row.derived_status,
    generatedAt: row.derived_metadata?.generatedAt ?? null,
    jdSnippet: row.linked_jd_text?.slice(0, 80) ?? null,
    matchRate: row.derived_metadata?.matchRate ?? null,
    children: [],
  }
}

export async function fetchVariantTree(currentResumeId: string): Promise<VariantLineage> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('用户未登陆')
  }

  const visited = new Set<string>()
  let walker: string | null = currentResumeId
  let rootRow: RawNode | null = null

  while (walker && !visited.has(walker)) {
    visited.add(walker)
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,parent_resume_id,display_name,derived_status,derived_metadata,linked_jd_text')
      .eq('user_id', user.id)
      .eq('resume_id', walker)
      .single()
    if (error) {
      throw error
    }
    rootRow = data as RawNode
    if (!rootRow.parent_resume_id) {
      break
    }
    walker = rootRow.parent_resume_id
  }
  if (!rootRow) {
    throw new Error('未找到任何节点')
  }

  const root = toTreeNode(rootRow)
  let queue: VariantTreeNode[] = [root]
  const seen = new Set<string>([root.resumeId])
  let bfsDepth = 0

  while (queue.length > 0 && bfsDepth < MAX_VARIANT_TREE_DEPTH) {
    const layerIds = queue.map(n => n.resumeId)
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,parent_resume_id,display_name,derived_status,derived_metadata,linked_jd_text')
      .eq('user_id', user.id)
      .in('parent_resume_id', layerIds)
    if (error) {
      throw error
    }
    const rows = (data ?? []) as RawNode[]
    const nextLayer: VariantTreeNode[] = []
    for (const row of rows) {
      if (seen.has(row.resume_id))
        continue
      seen.add(row.resume_id)
      const child = toTreeNode(row)
      const parent = queue.find(p => p.resumeId === row.parent_resume_id)
      parent?.children.push(child)
      nextLayer.push(child)
    }
    queue = nextLayer
    bfsDepth += 1
  }

  return { root, currentId: currentResumeId }
}
