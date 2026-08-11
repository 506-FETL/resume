import supabase from './client'

// GitHub star 计数（服务端缓存，每仓库一行）。字段与 get_github_stars() 返回一致。
export interface GithubStars {
  repo: string
  stars: number
  fetchedAt: string | null
  // 服务端拉取失败、返回的是旧缓存（或 0）；前端可据此走兜底刷新
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
 * 主路径依赖实例的 pgsql-http 扩展；不可用时返回 stale=true，由调用方走 setGithubStars 兜底。
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

/**
 * 兜底回写：当服务端无法拉取（pgsql-http 不可用）时，前端自行 fetch GitHub 后调用它写回共享表。
 * RPC 内对「有效缓存内不覆盖」做了保护，多客户端并发调用安全。
 */
export async function setGithubStars(owner: string, repo: string, stars: number): Promise<GithubStars> {
  const { data, error } = await supabase.rpc('set_github_stars', {
    p_owner: owner,
    p_repo: repo,
    p_stars: stars,
  })

  if (error)
    throw error

  const raw = (data ?? {}) as Partial<RawGithubStars>
  return {
    repo: raw.repo ?? `${owner}/${repo}`.toLowerCase(),
    stars: raw.stars ?? stars,
    fetchedAt: raw.fetched_at ?? null,
    stale: false,
  }
}
