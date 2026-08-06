import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useEffect, useMemo, useState } from 'react'
import { getAllResumesFromUser, getResumeById } from '@/lib/supabase/resume'
import { buildResumeSnapshot } from '@/pages/history/utils'
import useCurrentResumeStore from '@/store/resume/current'
import { getErrorMessage } from '@/utils'
import useAssistantStore from '../store'
import { useCanvasModel } from './use-canvas-model'

interface ResumeOption { resumeId: string, name: string }

// 模块级缓存：跨组件卸载/重挂（折叠画布、切换侧边栏、移动端 Sheet）复用，
// 避免重新加载时的骨架闪烁
const snapshotCache = new Map<string, ResumeSnapshot>()

export function useCanvasPreview() {
  const { previewResumeId, setPreviewResumeId, canvasRefreshTick } = useAssistantStore()
  const currentResumeId = useCurrentResumeStore(s => s.resumeId)
  const { writes } = useCanvasModel()
  const [options, setOptions] = useState<ResumeOption[]>([])
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(
    () => (previewResumeId ? snapshotCache.get(previewResumeId) ?? null : null),
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')

  // 仅统计「已应用」的简历写操作 → 确认卡出现时(awaiting-confirm)不触发，
  // 用户确认并写入 DB 后(state=result)才刷新，避免读到旧数据
  const resumeWriteCount = useMemo(
    () => writes.filter(w => w.category === 'resume' && w.state === 'result').length,
    [writes],
  )

  // 下拉选项
  useEffect(() => {
    getAllResumesFromUser()
      .then((rows) => {
        const list = ((rows ?? []) as Array<Record<string, unknown>>).map(r => ({
          resumeId: String(r.resume_id),
          name: String(r.display_name ?? '未命名'),
        }))
        setOptions(list)
      })
      .catch(() => setOptions([]))
  }, [resumeWriteCount])

  // 种子：previewResumeId 为空时跟随全局当前编辑简历
  useEffect(() => {
    if (!previewResumeId && currentResumeId)
      setPreviewResumeId(currentResumeId)
  }, [currentResumeId, previewResumeId, setPreviewResumeId])

  // AI open/create 改了当前编辑简历 → 联动切换预览
  useEffect(() => {
    if (currentResumeId && currentResumeId !== previewResumeId)
      setPreviewResumeId(currentResumeId)
    // 仅在 currentResumeId 变化时联动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentResumeId])

  // 拉取被预览简历
  useEffect(() => {
    if (!previewResumeId) {
      setSnapshot(null)
      setStatus(options.length === 0 ? 'empty' : 'idle')
      return
    }
    let cancelled = false
    // 命中缓存则直接展示（无骨架），后台静默 revalidate
    const cached = snapshotCache.get(previewResumeId)
    if (cached) {
      setSnapshot(cached)
      setStatus('idle')
    }
    else {
      setStatus('loading')
    }
    getResumeById(previewResumeId, '*')
      .then((data) => {
        if (cancelled)
          return
        const next = buildResumeSnapshot(data)
        snapshotCache.set(previewResumeId, next)
        setSnapshot(next)
        setStatus('idle')
      })
      .catch((error) => {
        if (cancelled)
          return
        getErrorMessage(error)
        if (!snapshotCache.has(previewResumeId)) {
          setSnapshot(null)
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [previewResumeId, resumeWriteCount, options.length, canvasRefreshTick])

  const currentName = options.find(o => o.resumeId === previewResumeId)?.name ?? null

  return { previewResumeId, options, snapshot, status, currentName }
}
