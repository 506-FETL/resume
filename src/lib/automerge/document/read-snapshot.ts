import supabase from '@/lib/supabase/client'

export interface AutomergeSnapshotRow {
  document_data: unknown
}

export async function readAutomergeSnapshot(
  resumeId: string,
  userId: string,
): Promise<AutomergeSnapshotRow | null> {
  const { data, error } = await supabase
    .rpc(
      'get_automerge_snapshot',
      { p_resume_id: resumeId, p_user_id: userId },
      { get: true },
    )
    .maybeSingle()

  if (error) {
    throw new Error('读取持久化简历文档失败', { cause: error })
  }

  if (data === null) return null
  if (data === undefined) {
    throw new Error('读取持久化简历文档失败：服务端未返回明确结果')
  }

  return data as AutomergeSnapshotRow
}
