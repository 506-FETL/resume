import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getAccessibleResumeById, listAccessibleResumes } from '@/lib/resume-access'
import { isResumeNotFoundError } from '@/lib/resume-id'
import { buildResumeSnapshot } from '@/pages/history/utils'
import useCurrentResumeStore from '@/store/resume/current'
import useAssistantStore from '../store'
import { useCanvasModel } from './use-canvas-model'

interface ResumeOption { resumeId: string, name: string }

// 模块级缓存：跨组件卸载/重挂（折叠画布、切换侧边栏、移动端 Drawer）复用，
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
  const isMobile = useIsMobile()
  const canvasVisible = useAssistantStore(s => isMobile ? s.canvasMobileOpen : s.canvasOpen)
  const { previewResumeId, setPreviewResumeId, canvasRefreshTick, canvasActiveTab } = useAssistantStore()
  const activeConversationId = useAssistantStore(s => s.activeConversationId)
  const conversations = useAssistantStore(s => s.conversations)
  const currentResumeId = useCurrentResumeStore(s => s.resumeId)
  const clearCurrentResume = useCurrentResumeStore(s => s.clearCurrentResume)
  const { writes } = useCanvasModel()
  const [options, setOptions] = useState<ResumeOption[]>([])
  const [optionsStatus, setOptionsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const optionsLoadingRef = useRef(false)
  const [optionsLoadedForCurrentId, setOptionsLoadedForCurrentId] = useState<string | null | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(
    () => (previewResumeId ? snapshotCache.get(previewResumeId) ?? null : null),
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'empty'>(snapshot ? 'idle' : 'loading')

  // 当前会话绑定的简历（画布预览按会话切换的核心）：优先于全局当前简历。
  const boundResumeId = useMemo(
    () => conversations.find(c => c.id === activeConversationId)?.resumeId ?? null,
    [conversations, activeConversationId],
  )

  // 仅统计「已应用」的简历写操作 → 确认卡出现时(awaiting-confirm)不触发，
  // 用户确认并写入 DB 后(state=result)才刷新，避免读到旧数据
  const resumeWriteCount = useMemo(
    () => writes.filter(w => w.category === 'resume' && w.state === 'result').length,
    [writes],
  )

  // 下拉选项
  useEffect(() => {
    if (!canvasVisible)
      return
    let cancelled = false
    optionsLoadingRef.current = true
    setOptionsStatus('loading')
    setOptionsLoadedForCurrentId(undefined)
    const currentIdAtLoad = currentResumeId
    listAccessibleResumes()
      .then((rows) => {
        if (cancelled)
          return
        optionsLoadingRef.current = false
        const list = rows.map(r => ({
          resumeId: String(r.resume_id),
          name: String(r.display_name ?? '未命名'),
        }))
        setOptions(list)
        setOptionsLoadedForCurrentId(currentIdAtLoad)
        setOptionsStatus('ready')
      })
      .catch(() => {
        if (!cancelled) {
          optionsLoadingRef.current = false
          setOptionsStatus('error')
          setSnapshot(null)
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [canvasVisible, currentResumeId, resumeWriteCount])

  // 列表成功后再解析目标，避免把本地 ID 或已失效 ID 直接送入错误的数据源。
  useEffect(() => {
    if (optionsStatus !== 'ready' || optionsLoadedForCurrentId !== currentResumeId)
      return

    const availableIds = new Set(options.map(option => option.resumeId))
    const hasCurrentResume = Boolean(currentResumeId && availableIds.has(currentResumeId))
    if (currentResumeId && !hasCurrentResume)
      clearCurrentResume()

    // 优先级：当前会话绑定的简历 > 全局当前简历 > 上次预览 > 列表首个。
    // 这样切换会话时，画布预览跟随该会话正在查看/修改的简历，而非全局当前简历。
    const hasBoundResume = Boolean(boundResumeId && availableIds.has(boundResumeId))
    const nextPreviewResumeId = hasBoundResume
      ? boundResumeId
      : hasCurrentResume
        ? currentResumeId
        : previewResumeId && availableIds.has(previewResumeId)
          ? previewResumeId
          : options[0]?.resumeId ?? null

    if (nextPreviewResumeId !== previewResumeId)
      setPreviewResumeId(nextPreviewResumeId)

    if (!nextPreviewResumeId) {
      setSnapshot(null)
      setStatus('empty')
    }
  }, [boundResumeId, clearCurrentResume, currentResumeId, options, optionsLoadedForCurrentId, optionsStatus, previewResumeId, setPreviewResumeId])

  // 拉取被预览简历
  useEffect(() => {
    // 列表 effect 先运行；避免重开同一帧先用旧列表发起一次重复请求。
    if (optionsLoadingRef.current || optionsStatus !== 'ready')
      return
    if (!previewResumeId) {
      setSnapshot(null)
      setStatus('empty')
      return
    }
    if (!options.some(option => option.resumeId === previewResumeId))
      return
    // 预览保留挂载；重新打开画布或切回简历标签时静默刷新。
    if (!canvasVisible || canvasActiveTab !== 'resume')
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
    getAccessibleResumeById(previewResumeId)
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
        if (isResumeNotFoundError(error)) {
          snapshotCache.delete(previewResumeId)
          setOptions(current => current.filter(option => option.resumeId !== previewResumeId))
          if (currentResumeId === previewResumeId)
            clearCurrentResume()
          setPreviewResumeId(null)
        }
        if (!snapshotCache.has(previewResumeId)) {
          setSnapshot(null)
          setStatus(isResumeNotFoundError(error) ? 'empty' : 'error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [canvasActiveTab, canvasRefreshTick, canvasVisible, clearCurrentResume, currentResumeId, options, optionsStatus, previewResumeId, resumeWriteCount, setPreviewResumeId])

  const currentName = options.find(o => o.resumeId === previewResumeId)?.name ?? null

  return { previewResumeId, options, snapshot, status, currentName }
}
