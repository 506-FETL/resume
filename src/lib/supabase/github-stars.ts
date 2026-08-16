import supabase from './client'

// GitHub star 计数（服务端缓存，每仓库一行）。字段与 get_github_stars() 返回一致。
export interface GithubStars {
  repo: string
  stars: number
  fetchedAt: string | null
  // 服务端拉取失败时返回旧缓存（或 0）；调用方可仅在当前页面展示公开 API 的值
  stale: boolean
}

interface RawGithubStars {
  repo: string
  stars: number
  fetched_at: string | null
  stale: boolean
}

/**
 * 读取仓库 star 数（懒刷新在 RPC 内完成：超 1 天则服务端拉取 GitHub 并回写，否则返回缓存）。
 * 过渡期主路径仍依赖实例的 pgsql-http 扩展；不可用时返回 stale=true。
 */
export async function getGithubStars(owner: string, repo: string): Promise<GithubStars> {
  const { data, error } = await supabase.rpc('get_github_stars', {
    p_owner: owner,
    p_repo: repo,
  })

  if (error)
    throw error

  const raw = (data ?? {}) as Partial<RawGithubStars>
  return {
    repo: raw.repo ?? `${owner}/${repo}`.toLowerCase(),
    stars: raw.stars ?? 0,
    fetchedAt: raw.fetched_at ?? null,
    stale: raw.stale ?? false,
  }
}
