import { useEffect } from 'react'
import { useChangelogStatus } from '@/hooks/use-changelog-status'
import { LATEST_CHANGELOG_ENTRY } from '@/lib/changelog-release'
import { useChangelogStore } from '@/store/changelog'

export function useReadChangelog() {
  const { account } = useChangelogStatus()

  useEffect(() => {
    if (!account || !LATEST_CHANGELOG_ENTRY) return

    useChangelogStore.getState().markAsRead(account, LATEST_CHANGELOG_ENTRY)
  }, [account])
}
