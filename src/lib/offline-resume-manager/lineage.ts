import type {
  VariantLineage,
  VariantTreeNode,
} from '@/lib/supabase/resume/variant'
import type { OfflineResumeRecord } from './database'
import { getDB } from './database'

export const MAX_VARIANT_TREE_DEPTH = 5

/**
 * 构建以 currentResumeId 所属树为基准的 lineage：
 * - 先沿 parent 链向上找到真正的 root（visited 防环，无步数上限）
 * - 再从 root 向下 BFS 构建子树（深度上限 MAX_VARIANT_TREE_DEPTH）
 */
export async function fetchOfflineVariantTree(
  currentResumeId: string,
): Promise<VariantLineage> {
  const db = await getDB()
  const all = await db.getAll('resumes')
  const byId = new Map(all.map((r) => [r.resume_id, r]))

  const visited = new Set<string>()
  let walker: string | null = currentResumeId
  let rootId = currentResumeId

  while (walker && !visited.has(walker)) {
    visited.add(walker)
    rootId = walker

    const node = byId.get(walker)

    walker = node?.parent_resume_id ?? null
  }

  const childrenByParent = new Map<string, OfflineResumeRecord[]>()

  for (const record of all) {
    const parentId = record.parent_resume_id ?? null

    if (!parentId) {
      continue
    }

    const list = childrenByParent.get(parentId)

    if (list) {
      list.push(record)
    } else {
      childrenByParent.set(parentId, [record])
    }
  }

  const seen = new Set<string>([rootId])

  function build(id: string, lvl: number): VariantTreeNode {
    const r = byId.get(id)

    if (!r) {
      throw new Error('简历节点不存在')
    }

    const childRecords =
      lvl >= MAX_VARIANT_TREE_DEPTH ? [] : (childrenByParent.get(id) ?? [])

    const children: VariantTreeNode[] = []

    for (const c of childRecords) {
      if (seen.has(c.resume_id)) {
        continue
      }

      seen.add(c.resume_id)
      children.push(build(c.resume_id, lvl + 1))
    }

    return {
      resumeId: r.resume_id,
      displayName: r.display_name,
      derivedStatus: r.derived_status ?? null,
      generatedAt: r.derived_metadata?.generatedAt ?? null,
      jdSnippet: r.linked_jd_text?.slice(0, 80) ?? null,
      matchRate: r.derived_metadata?.matchRate ?? null,
      children,
    }
  }

  return { root: build(rootId, 0), currentId: currentResumeId }
}
