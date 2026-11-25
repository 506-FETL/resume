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
 * - 再从 root 沿父键索引读取子树（深度上限 MAX_VARIANT_TREE_DEPTH）
 */
export async function fetchOfflineVariantTree(
  currentResumeId: string,
): Promise<VariantLineage> {
  const db = await getDB()
  const tx = db.transaction('resumes')
  const ancestors = new Set<string>()
  let id = currentResumeId
  let root: OfflineResumeRecord

  while (true) {
    const record = await tx.store.get(id)

    if (!record) throw new Error('简历节点不存在')

    ancestors.add(id)
    root = record

    if (!record.parent_resume_id || ancestors.has(record.parent_resume_id))
      break

    id = record.parent_resume_id
  }

  const childrenByParent = tx.store.index('parent_resume_id')
  const seen = new Set<string>([root.resume_id])

  async function build(
    record: OfflineResumeRecord,
    depth: number,
  ): Promise<VariantTreeNode> {
    const childRecords =
      depth < MAX_VARIANT_TREE_DEPTH
        ? await childrenByParent.getAll(record.resume_id)
        : []

    const children = childRecords.filter((child) => !seen.has(child.resume_id))

    for (const child of children) seen.add(child.resume_id)

    return {
      resumeId: record.resume_id,
      displayName: record.display_name,
      derivedStatus: record.derived_status ?? null,
      generatedAt: record.derived_metadata?.generatedAt ?? null,
      jdSnippet: record.linked_jd_text?.slice(0, 80) ?? null,
      matchRate: record.derived_metadata?.matchRate ?? null,
      children: await Promise.all(
        children.map((child) => build(child, depth + 1)),
      ),
    }
  }

  const tree = await build(root, 0)

  await tx.done

  return { root: tree, currentId: currentResumeId }
}
