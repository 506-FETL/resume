import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export type ShareStatusFilter = 'all' | 'active' | 'inactive' | 'expired'

export function buildShareUrl(token: string) {
  return `${window.location.origin}/share/view/${token}`
}

export function formatShareUrlForDisplay(url: string) {
  try {
    const parsed = new URL(url)
    const token = parsed.pathname.split('/').at(-1) ?? ''
    const shortToken = token.length > 18
      ? `${token.slice(0, 8)}…${token.slice(-7)}`
      : token
    return `${parsed.host}/share/view/${shortToken}`
  }
  catch {
    return url
  }
}

export function dateToExpiryIso(date: Date | undefined) {
  if (!date)
    return null
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next.toISOString()
}

export function expiryIsoToDate(value: string | null) {
  return value ? new Date(value) : undefined
}

export function deriveShareStatus(share: ResumeShareRecord): Exclude<ShareStatusFilter, 'all'> {
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now())
    return 'expired'
  return share.is_active ? 'active' : 'inactive'
}

export function filterShares(
  shares: ResumeShareRecord[],
  filters: {
    keyword: string
    resumeIds: string[]
    status: ShareStatusFilter
  },
) {
  const keyword = filters.keyword.trim().toLocaleLowerCase()

  return shares.filter((share) => {
    if (filters.resumeIds.length > 0 && !filters.resumeIds.includes(share.resume_id))
      return false
    if (filters.status !== 'all' && deriveShareStatus(share) !== filters.status)
      return false
    if (!keyword)
      return true

    return [
      share.label,
      share.display_name,
      share.token,
    ].some(value => value?.toLocaleLowerCase().includes(keyword))
  })
}
