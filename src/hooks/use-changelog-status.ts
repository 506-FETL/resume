import { LATEST_CHANGELOG_ENTRY } from '@/lib/changelog-release'
import { useChangelogStore } from '@/store/changelog'
import useUserStore from '@/store/user'

export function useChangelogStatus() {
  const account = useUserStore((state) =>
    state.authStatus === 'unknown' ? null : (state.currentUser?.id ?? 'guest'),
  )

  const seenEntry = useChangelogStore((state) =>
    account ? state.seenEntries[account] : undefined,
  )

  return {
    account,
    hasUnread: account !== null && LATEST_CHANGELOG_ENTRY > (seenEntry ?? ''),
  }
}
