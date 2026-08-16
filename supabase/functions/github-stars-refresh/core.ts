export const APP_GITHUB_REPOSITORY = '506-FETL/resume'
export const APP_GITHUB_REPOSITORY_KEY = '506-fetl/resume'
export const APP_GITHUB_API_URL = `https://api.github.com/repos/${APP_GITHUB_REPOSITORY}`

export type GithubRefreshErrorCode
  = | 'github_rate_limited'
    | 'github_upstream_error'
    | 'github_unexpected_status'
    | 'github_timeout'
    | 'github_invalid_response'

export function readGithubStars(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const stars = (value as Record<string, unknown>).stargazers_count
  return Number.isSafeInteger(stars) && Number(stars) >= 0
    ? Number(stars)
    : null
}

export function normalizeGithubEtag(value: string | null): string | null {
  const etag = value?.trim() ?? ''
  return etag && etag.length <= 256 ? etag : null
}

export function classifyGithubStatus(status: number): GithubRefreshErrorCode {
  if (status === 403 || status === 429)
    return 'github_rate_limited'
  if (status >= 500)
    return 'github_upstream_error'
  return 'github_unexpected_status'
}

export function buildGithubFailureUpdate(
  consecutiveFailures: number,
  errorCode: GithubRefreshErrorCode,
  attemptedAt: string,
) {
  return {
    last_attempt_at: attemptedAt,
    last_error_at: attemptedAt,
    last_error_code: errorCode,
    consecutive_failures: Math.max(0, consecutiveFailures) + 1,
  }
}
