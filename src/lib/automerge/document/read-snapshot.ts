import supabase from '@/lib/supabase/client'

export interface AutomergeSnapshotRow {
  document_data: unknown
}

export async function readAutomergeSnapshot(
  resumeId: string,
  userId: string,
): Promise<AutomergeSnapshotRow | null> {
  const { data, error } = await supabase
    .from('automerge_documents')
    .select('document_data')
    .eq('resume_id', resumeId)
    .eq('user_id', userId)
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
