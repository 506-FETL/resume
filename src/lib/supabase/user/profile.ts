import type { UserAttributes } from '@supabase/supabase-js'
import supabase from '../client'

export async function getUserProfile() {
  const user = await getCurrentUser()

  if (!user) throw new Error('未登陆用户')

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, updated_at')
    .eq('id', user.id)
    .single()

  if (error) throw error

  return data
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession()

  if (error) return null

  return data.session?.user ?? null
}

export async function changeAvatar(file: File) {
  const user = await getCurrentUser()

  if (!user) throw new Error('未登陆用户')

  // 两处引用可能已不一致，先记录各自旧文件；读失败时不启动替换。
  const { data: oldProfile, error: readErr } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (readErr) throw readErr

  const storage = supabase.storage.from('avatar')
  const baseUrl = new URL(storage.getPublicUrl('').data.publicUrl)
  const oldPaths = new Set<string>()

  for (const oldAvatarUrl of [
    user.user_metadata?.avatar_url,
    oldProfile?.avatar_url,
  ]) {
    if (typeof oldAvatarUrl !== 'string') continue

    try {
      const url = new URL(oldAvatarUrl)

      if (
        url.origin !== baseUrl.origin ||
        !url.pathname.startsWith(baseUrl.pathname)
      )
        continue

      const oldPath = decodeURIComponent(
        url.pathname.slice(baseUrl.pathname.length),
      )

      if (!oldPath.startsWith(`${user.id}/`) || oldPath.includes('\\')) continue
      if (
        oldPath
          .split('/')
          .some((part) => !part || part === '.' || part === '..')
      )
        continue

      oldPaths.add(oldPath)
    } catch {
      // 外部、无效或无法安全解析的 URL 不属于可清理对象。
    }
  }

  // 每次上传使用独立路径，禁止覆盖仍被任一引用使用的旧对象。
  let path: string

  do {
    path = `${user.id}/${crypto.randomUUID()}`
  } while (oldPaths.has(path))

  const { error: upErr } = await storage.upload(path, file, {
    upsert: false,
  })

  if (upErr) throw upErr

  const { data } = storage.getPublicUrl(path)
  const avatarUrl = data.publicUrl

  // 后续失败或响应丢失时保留新旧对象，避免删除可能已经被引用的文件。
  const { data: authData, error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  })

  if (error) throw error
  if (
    authData.user?.id !== user.id ||
    authData.user.user_metadata?.avatar_url !== avatarUrl
  )
    throw new Error('头像认证资料更新未确认，请重试')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('avatar_url')
    .single()

  if (profileErr) throw profileErr
  if (profile.avatar_url !== avatarUrl)
    throw new Error('头像用户资料更新未确认，请重试')

  // 两处引用均确认更新后才清理；清理失败不改变更换成功的结果。
  if (oldPaths.size) {
    try {
      await storage.remove([...oldPaths])
    } catch {
      // 旧文件保留可稍后清理，不影响新头像可用性。
    }
  }

  return avatarUrl
}

export async function updateProfile(attributes: UserAttributes) {
  const { error } = await supabase.auth.updateUser(attributes)

  if (error) throw error

  // 若更新了 full_name / avatar_url，同步写回 profiles 表保持一致
  const meta = attributes.data as
    | { full_name?: string; avatar_url?: string }
    | undefined

  if (meta && (meta.full_name !== undefined || meta.avatar_url !== undefined)) {
    const user = await getCurrentUser()

    if (user) {
      const patch: {
        id: string
        updated_at: string
        full_name?: string
        avatar_url?: string
      } = { id: user.id, updated_at: new Date().toISOString() }

      if (meta.full_name !== undefined) patch.full_name = meta.full_name
      if (meta.avatar_url !== undefined) patch.avatar_url = meta.avatar_url

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(patch, { onConflict: 'id' })

      if (profileErr) throw profileErr
    }
  }
}
