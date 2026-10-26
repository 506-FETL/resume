import type { SharePurpose } from '@/lib/supabase/resume/share.types'

export const SHARE_PURPOSE_LABELS: Record<SharePurpose, string> = {
  review: '请人审阅',
  application: '正式投递',
  showcase: '公开展示',
}

export function sharePurposeDefaults(purpose: SharePurpose) {
  return {
    purpose,
    showPhone: purpose !== 'showcase',
    showEmail: purpose !== 'showcase',
    allowComments: purpose === 'review',
  }
}
