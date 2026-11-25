import type { ShareManagementStatus } from '@/lib/supabase/resume/share/management'
import type { VersionDialogSelection } from './types'
import type {
  ResumeShareRecord,
  ShareVersionSelection,
  ShareVersionSource,
} from '@/lib/supabase/resume/share.types'

export type { ShareManagementStatus as ShareStatusFilter } from '@/lib/supabase/resume/share/management'

export function formatShareVersionSource(source: ShareVersionSource) {
  return source.kind === 'current'
    ? '当前版本'
    : `V${source.versionNo} · ${source.versionLabel}`
}

export function toVersionDialogSelection(
  source: ShareVersionSource,
): VersionDialogSelection {
  if (source.kind === 'current') return source

  if (source.versionId != null) {
    return {
      kind: 'history',
      versionId: source.versionId,
    }
  }

  return {
    kind: 'deleted-history',
    versionNo: source.versionNo,
    versionLabel: source.versionLabel,
    versionCreatedAt: source.versionCreatedAt,
  }
}

export function isPublishableVersionSelection(
  value: VersionDialogSelection,
): value is ShareVersionSelection {
  return value.kind === 'current' || value.kind === 'history'
}

export function buildShareUrl(token: string) {
  return `${window.location.origin}/share/view/${token}`
}

export function formatShareUrlForDisplay(url: string) {
  try {
    const parsed = new URL(url)
    const token = parsed.pathname.split('/').at(-1) ?? ''

    const shortToken =
      token.length > 18 ? `${token.slice(0, 8)}…${token.slice(-7)}` : token

    return `${parsed.host}/share/view/${shortToken}`
  } catch {
    return url
  }
}

export function dateToExpiryIso(date: Date | undefined) {
  if (!date) return null

  const next = new Date(date)

  next.setHours(23, 59, 59, 999)

  return next.toISOString()
}

export function expiryIsoToDate(value: string | null) {
  return value ? new Date(value) : undefined
}

export function deriveShareStatus(
  share: ResumeShareRecord,
): Exclude<ShareManagementStatus, 'all'> {
  if (share.archivedAt) return 'archived'
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now())
    return 'expired'

  return share.is_active ? 'active' : 'inactive'
}

export function findShareById(
  pageShares: ResumeShareRecord[],
  dialogShares: ResumeShareRecord[],
  shareId: string | null,
) {
  if (!shareId) return null

  return (
    pageShares.find((share) => share.id === shareId) ??
    dialogShares.find((share) => share.id === shareId) ??
    null
  )
}
