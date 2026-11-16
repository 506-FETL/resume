import type { DerivedStatus } from '@/lib/schema'
import supabase from '../../client'
import { getCurrentUser } from '../../user'

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

export const MAX_VARIANT_TREE_DEPTH = 5

export interface RawNode {
  resume_id: string
  parent_resume_id: string | null
  display_name: string | null
  derived_status: DerivedStatus | null
  generated_at: string | null
  match_rate: number | null
  jd_excerpt: string | null
}

export const LINEAGE_SELECTOR =
  'resume_id,parent_resume_id,display_name,derived_status,generated_at:derived_metadata->>generatedAt,match_rate:derived_metadata->matchRate,jd_excerpt:resume_jd_excerpt'

export function toTreeNode(row: RawNode): VariantTreeNode {
  return {
    resumeId: row.resume_id,
    displayName: row.display_name ?? '未命名简历',
    derivedStatus: row.derived_status,
    generatedAt: row.generated_at,
    jdSnippet: row.jd_excerpt,
    matchRate: row.match_rate,
    children: [],
  }
}

export async function fetchVariantTree(
  currentResumeId: string,
): Promise<VariantLineage> {
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
      .select(LINEAGE_SELECTOR)
      .eq('user_id', user.id)
      .eq('resume_id', walker)
      .maybeSingle()

    if (error) {
      throw error
    }
    // 查不到行（如协作者受 RLS 限制读不到所有者的 resume_config）：返回仅含当前节点的最小血缘，
    // 避免 .single() 的 0 行 406 报错在控制台刷红，同时血缘按钮已在协作者场景禁用。
    if (!data) {
      break
    }

    rootRow = data as unknown as RawNode

    if (!rootRow.parent_resume_id) {
      break
    }

    walker = rootRow.parent_resume_id
  }

  if (!rootRow) {
    return {
      root: {
        resumeId: currentResumeId,
        displayName: '未命名简历',
        derivedStatus: null,
        generatedAt: null,
        jdSnippet: null,
        matchRate: null,
        children: [],
      },
      currentId: currentResumeId,
    }
  }

  const root = toTreeNode(rootRow)
  let queue: VariantTreeNode[] = [root]
  const seen = new Set<string>([root.resumeId])
  let bfsDepth = 0

  while (queue.length > 0 && bfsDepth < MAX_VARIANT_TREE_DEPTH) {
    const layerIds = queue.map((n) => n.resumeId)

    const { data, error } = await supabase
      .from('resume_config')
      .select(LINEAGE_SELECTOR)
      .eq('user_id', user.id)
      .in('parent_resume_id', layerIds)

    if (error) {
      throw error
    }

    const rows = (data ?? []) as unknown as RawNode[]
    const nextLayer: VariantTreeNode[] = []

    for (const row of rows) {
      if (seen.has(row.resume_id)) continue

      seen.add(row.resume_id)

      const child = toTreeNode(row)
      const parent = queue.find((p) => p.resumeId === row.parent_resume_id)

      parent?.children.push(child)
      nextLayer.push(child)
    }

    queue = nextLayer
    bfsDepth += 1
  }

  return { root, currentId: currentResumeId }
}
