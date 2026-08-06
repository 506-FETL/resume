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

// 清除快照缓存：AI 写简历成功后调用，避免写后重取时先命中旧缓存造成「画布不刷新」的观感。
// 不传 resumeId 时清空全部（写操作可能影响 currentResumeId 联动的任意预览目标）。
export function invalidateCanvasSnapshot(resumeId?: string): void {
  if (resumeId)
    snapshotCache.delete(resumeId)
  else
    snapshotCache.clear()
}

export function useCanvasPreview() {
  const { previewResumeId, setPreviewResumeId, canvasRefreshTick, canvasActiveTab } = useAssistantStore()
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
    // 只在简历 tab 激活时拉取；切到简历 tab 时（canvasActiveTab 依赖变化）每次都重新加载最新 DB 数据，
    // 一劳永逸地避免画布停留在旧内容（预览面板 forceMount 常驻，故用 tab 激活作为刷新时机）
    if (canvasActiveTab !== 'resume')
      return
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
  }, [previewResumeId, resumeWriteCount, options.length, canvasRefreshTick, canvasActiveTab])

  const currentName = options.find(o => o.resumeId === previewResumeId)?.name ?? null

  return { previewResumeId, options, snapshot, status, currentName }
}
