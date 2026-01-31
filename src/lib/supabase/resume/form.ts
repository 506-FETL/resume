import supabase from '../client'
import { getCurrentUser } from '../user'

export async function getAllResumesFromUser() {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select('id,resume_id,created_at,updated_at,type,display_name,description')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, 10)

  if (error) {
    throw error
  }

  return data
}

export async function getResumeById<T extends string>(id: string, selector = '*' as T) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .select(selector)
    .eq('user_id', user.id)
    .eq('resume_id', id)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function uploadOfflineResumeToCloud(
  resumeData: any,
  info: { display_name: string, description?: string },
  type: string = 'default',
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type,
      ...info,
      ...resumeData, // 将简历数据展开插入
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function createNewResume(
  info: { display_name?: string, description?: string } = {
    display_name: '简历',
    description: new Date().toLocaleDateString(),
  },
  type: string = 'default',
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      user_id: user.id,
      type,
      ...info,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function deleteResume(id: string) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { error } = await supabase.from('resume_config').delete().eq('resume_id', id).eq('user_id', user.id)

  if (error) {
    throw error
  }

  return true
}

export async function deleteResumeFromId(id: string) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { error } = await supabase.from('resume_config').delete().eq('id', id).eq('user_id', user.id)

  if (error) {
    throw error
  }

  return true
}
