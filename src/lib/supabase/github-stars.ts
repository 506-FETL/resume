import supabase from './client'

// GitHub star 计数只读取服务端维护的应用仓库缓存。
export interface GithubStars {
  repo: string
  stars: number
  fetchedAt: string
  stale: boolean
}

interface RawGithubStars {
  repo: string
  stars: number
  fetched_at: string
  stale: boolean
}

/**
 * 读取应用仓库的最后一次成功缓存。刷新由受保护的 Edge 定时任务负责；
 * 缓存缺失或结构异常时返回 null，避免把未知状态误报为 0。
 */
export async function getGithubStars(): Promise<GithubStars | null> {
  const { data, error } = await supabase.rpc('get_app_github_stars')

  if (error)
    throw error

  if (!data || typeof data !== 'object' || Array.isArray(data))
    return null

  const raw = data as Partial<RawGithubStars>
  if (
    raw.repo !== '506-fetl/resume'
    || !Number.isSafeInteger(raw.stars)
    || Number(raw.stars) < 0
    || typeof raw.fetched_at !== 'string'
    || typeof raw.stale !== 'boolean'
  ) {
    return null
  }

  return {
    repo: raw.repo,
    stars: Number(raw.stars),
    fetchedAt: raw.fetched_at,
    stale: raw.stale,
  }
}
