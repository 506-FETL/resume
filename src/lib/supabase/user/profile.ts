import type { UserAttributes } from '@supabase/supabase-js'
import supabase from '../client'

export async function getUserProfile() {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('未登陆用户')

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, updated_at')
    .eq('id', user.id)
    .single()

  if (error)
    throw error
  return data
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession()

  if (error)
    return null

  return data.session?.user ?? null
}

export async function changeAvatar(file: File) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('未登陆用户')

  // 尝试删除旧头像文件（忽略错误，可能不存在）
  const oldAvatarUrl = user.user_metadata?.avatar_url
  if (oldAvatarUrl) {
    try {
      const url = new URL(oldAvatarUrl)
      // 提取 storage 路径：/storage/v1/object/public/avatar/{path}
      const match = url.pathname.match(/\/storage\/v1\/object\/public\/avatar\/(.+)/)
      if (match?.[1]) {
        await supabase.storage.from('avatar').remove([decodeURIComponent(match[1])])
      }
    }
    catch {
      // 旧头像清理失败不影响新头像上传
    }
  }

  const path = `${user.id}/${Date.now()}-${file.name}`

  const { error: upErr } = await supabase.storage.from('avatar').upload(path, file, {
    upsert: true,
  })
  if (upErr)
    throw upErr

  const { data } = supabase.storage.from('avatar').getPublicUrl(path)
  const avatarUrl = data.publicUrl

  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  })
  if (error)
    throw error

  // 同步写回 profiles 表，避免与 auth metadata 不同源
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
  if (profileErr)
    throw profileErr

  return avatarUrl
}

export async function updateProfile(attributes: UserAttributes) {
  const { error } = await supabase.auth.updateUser(attributes)

  if (error)
    throw error

  // 若更新了 full_name / avatar_url，同步写回 profiles 表保持一致
  const meta = attributes.data as { full_name?: string, avatar_url?: string } | undefined
  if (meta && (meta.full_name !== undefined || meta.avatar_url !== undefined)) {
    const user = await getCurrentUser()
    if (user) {
      const patch: {
        id: string
        updated_at: string
        full_name?: string
        avatar_url?: string
      } = { id: user.id, updated_at: new Date().toISOString() }
      if (meta.full_name !== undefined)
        patch.full_name = meta.full_name
      if (meta.avatar_url !== undefined)
        patch.avatar_url = meta.avatar_url

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(patch, { onConflict: 'id' })
      if (profileErr)
        throw profileErr
    }
  }
}
