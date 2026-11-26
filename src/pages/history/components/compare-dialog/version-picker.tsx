import type { ComparisonChoice } from './use-comparison'
import { useMemo } from 'react'
import { useStore } from 'zustand'
import type { versionOptions } from './version-options'
import useUserStore from '@/store/user'
import useHistoryStore from '../../store'
import HistoryOptionPicker from '../shared/option-picker'

function label(option: ComparisonChoice) {
  return option === 'current'
    ? '当前内容'
    : `第 ${option.version_no} 版 · ${new Date(option.created_at).toLocaleDateString()}`
}

function itemId(option: ComparisonChoice) {
  return option === 'current' ? option : String(option.id)
}

export default function VersionPicker({
  value,
  onChange,
  ariaLabel,
  pages,
}: {
  value?: ComparisonChoice
  onChange: (next: ComparisonChoice) => void
  ariaLabel: string
  pages: ReturnType<typeof versionOptions>
}) {
  const owner = useUserStore((s) => s.currentUser?.id)
  const versions = useHistoryStore((s) => s.versions)
  const total = useHistoryStore((s) => s.versionTotal)
  const hasCurrent = useHistoryStore((s) => Boolean(s.currentResume))
  const result = useStore(pages)
  const local = versions.length === total

  const ordered = useMemo(
    () =>
      local ? [...versions].sort((a, b) => b.version_no - a.version_no) : [],
    [local, versions],
  )

  const data = local
    ? {
        items: ordered,
        ready: true,
        loading: false,
        error: null,
        hasMore: false,
      }
    : result

  const options: ComparisonChoice[] = [
    ...(hasCurrent ? (['current'] as const) : []),
    ...data.items,
  ]

  function choose(id: string) {
    const option = options.find((row) => itemId(row) === id)

    if (option) onChange(option)
  }

  return (
    <HistoryOptionPicker
      label={ariaLabel}
      triggerClassName='h-8 gap-1 px-2 text-xs font-normal'
      emptyLabel='没有历史版本'
      value={value ? itemId(value) : null}
      trigger={value ? label(value) : '选择版本'}
      data={{ ...data, items: options }}
      itemId={itemId}
      itemLabel={label}
      onOpen={() => {
        if (!local && owner) result.load(owner, 'open')
      }}
      onMore={() => {
        if (!local && owner) result.load(owner, 'more')
      }}
      onChange={choose}
    />
  )
}
