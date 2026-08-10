import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DiffView } from '@/pages/assistant/components/diff/diff-view'
import { diffSnapshots, totalChangedFields } from '../../compare'
import useHistoryStore from '../../store'

const CURRENT = 'current'

interface CompareDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** 初始基准：版本 id 字符串 或 'current' */
  baseId: string | null
  /** 初始目标：版本 id 字符串 或 'current' */
  targetId: string | null
}

export default function CompareDialog({ open, onOpenChange, baseId, targetId }: CompareDialogProps) {
  const { versions, currentResume, loadVersionSnapshot, snapshotCache } = useHistoryStore()
  const [base, setBase] = useState<string>(baseId ?? CURRENT)
  const [target, setTarget] = useState<string>(targetId ?? CURRENT)
  const [beforeSnap, setBeforeSnap] = useState<ResumeSnapshot | null>(null)
  const [afterSnap, setAfterSnap] = useState<ResumeSnapshot | null>(null)
  const [loadingSnap, setLoadingSnap] = useState(false)

  // 重新打开时同步初始选择
  useEffect(() => {
    if (open) {
      setBase(baseId ?? CURRENT)
      setTarget(targetId ?? CURRENT)
    }
  }, [open, baseId, targetId])

  const options = useMemo(() => [
    ...(currentResume ? [{ value: CURRENT, label: '当前内容' }] : []),
    ...versions.map(version => ({
      value: String(version.id),
      label: `第 ${version.version_no} 版 · ${new Date(version.created_at).toLocaleDateString()}`,
    })),
  ], [versions, currentResume])

  // 按需解析某一侧的 snapshot：当前内容直接取；历史版本命中缓存或拉取
  const resolveSnap = useCallback(async (id: string): Promise<ResumeSnapshot | null> => {
    if (id === CURRENT)
      return currentResume?.snapshot ?? null
    const numId = Number(id)
    return snapshotCache[numId] ?? await loadVersionSnapshot(numId)
  }, [currentResume, snapshotCache, loadVersionSnapshot])

  useEffect(() => {
    if (!open)
      return
    let cancelled = false
    setLoadingSnap(true)
    Promise.all([resolveSnap(base), resolveSnap(target)]).then(([b, a]) => {
      if (!cancelled) {
        setBeforeSnap(b)
        setAfterSnap(a)
        setLoadingSnap(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, base, target, resolveSnap])

  const diffs = useMemo(
    () => (beforeSnap && afterSnap ? diffSnapshots(beforeSnap, afterSnap) : []),
    [beforeSnap, afterSnap],
  )
  const changed = totalChangedFields(diffs)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="min-h-0 sm:max-h-[82vh] sm:max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 gap-3 border-b px-6 pb-5 pt-6 text-left">
          <ResponsiveDialogTitle>版本对比</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>看看两个版本之间改了什么</ResponsiveDialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">→</span>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 w-auto min-w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {changed > 0 && (
              <span className="text-xs text-muted-foreground">
                共
                {' '}
                {changed}
                {' '}
                处改动
              </span>
            )}
          </div>
        </ResponsiveDialogHeader>

        <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-5 px-6 py-5">
            {loadingSnap
              ? (
                  <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                    正在加载版本内容…
                  </p>
                )
              : changed === 0
                ? (
                    <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
                      两个版本内容一样
                    </p>
                  )
                : diffs.map(section => (
                    <div key={section.sectionKey} className="flex flex-col gap-3">
                      <h3 className="text-sm font-semibold">{section.sectionLabel}</h3>
                      {section.fields.map(field => (
                        <div key={field.key} className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground">{field.label}</span>
                          <DiffView before={field.before} after={field.after} />
                        </div>
                      ))}
                    </div>
                  ))}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
