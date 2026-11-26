import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import { useEffect, useMemo, useState } from 'react'
import supabase from '@/lib/supabase/client'
import useUserStore from '@/store/user'
import { diffSnapshots, totalChangedFields } from '../../compare'
import useHistoryStore from '../../store'

export type VersionOption = Pick<
  ResumeHistoryVersionListItem,
  'id' | 'version_no' | 'created_at'
>

export type ComparisonChoice = VersionOption | 'current'

export function useDefaultBase(
  open: boolean,
  selected: VersionOption,
): {
  choice?: ComparisonChoice
  error: boolean
  retry: () => void
} {
  const versions = useHistoryStore((state) => state.versions)
  const total = useHistoryStore((state) => state.versionTotal)
  const resumeId = useHistoryStore((state) => state.resumeId)
  const hasCurrent = useHistoryStore((state) => Boolean(state.currentResume))
  const owner = useUserStore((state) => state.currentUser?.id)
  const [remote, setRemote] = useState<VersionOption | null>()
  const [error, setError] = useState(false)

  const previous = versions.find(
    (row) => row.version_no === selected.version_no - 1,
  )

  const complete = versions.length === total

  const fallback: ComparisonChoice | undefined = hasCurrent
    ? 'current'
    : versions.find((row) => row.id !== selected.id)

  const nearest = complete
    ? versions.reduce<VersionOption | undefined>(
        (best, row) =>
          row.version_no < selected.version_no &&
          (!best || row.version_no > best.version_no)
            ? row
            : best,
        undefined,
      )
    : undefined

  const known =
    previous ??
    nearest ??
    (complete || selected.version_no === 1 ? fallback : undefined)

  useEffect(() => {
    if (!open || known || remote !== undefined || error || !resumeId || !owner)
      return

    let active = true

    supabase
      .from('resume_config_versions')
      .select('id,version_no,created_at')
      .eq('user_id', owner)
      .eq('resume_id', resumeId)
      .eq('status', 'frozen')
      .lt('version_no', selected.version_no)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle<VersionOption>()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(true)
        else setRemote(data)
      })

    return () => {
      active = false
    }
  }, [open, known, remote, error, resumeId, owner, selected.version_no])

  return {
    choice: known ?? (remote === null ? fallback : remote),
    error,
    retry: () => setError(false),
  }
}

export function useComparison(
  open: boolean,
  base: ComparisonChoice | undefined,
  target: ComparisonChoice,
) {
  const leftId = typeof base === 'object' ? base.id : null
  const rightId = typeof target === 'object' ? target.id : null

  const before = useHistoryStore((s) =>
    base === 'current'
      ? s.currentResume?.snapshot
      : leftId === null
        ? undefined
        : s.snapshotCache[leftId],
  )

  const after = useHistoryStore((s) =>
    target === 'current'
      ? s.currentResume?.snapshot
      : rightId === null
        ? undefined
        : s.snapshotCache[rightId],
  )

  const leftError = useHistoryStore((s) =>
    base === 'current'
      ? s.currentResumeError
      : leftId === null
        ? undefined
        : s.snapshotErrors[leftId],
  )

  const rightError = useHistoryStore((s) =>
    rightId === null ? s.currentResumeError : s.snapshotErrors[rightId],
  )

  const load = useHistoryStore((s) => s.loadVersionSnapshot)

  useEffect(() => {
    if (!open) return

    if (leftId !== null && !before && !leftError) load(leftId)
    if (rightId !== null && !after && !rightError) load(rightId)
  }, [open, leftId, rightId, before, after, leftError, rightError, load])

  const diffs = useMemo(
    () =>
      before && after && before !== after ? diffSnapshots(before, after) : [],
    [before, after],
  )

  const changed = useMemo(() => totalChangedFields(diffs), [diffs])

  function retry() {
    if (leftId !== null && leftError) load(leftId)
    if (rightId !== null && rightError) load(rightId)
    if (
      (base === 'current' && leftError) ||
      (target === 'current' && rightError)
    )
      useHistoryStore.getState().reloadCurrentResume()
  }

  return {
    diffs,
    changed,
    loading: !before || !after,
    failed: Boolean(leftError || rightError),
    retry,
  }
}
