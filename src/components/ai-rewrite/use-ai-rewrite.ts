import type { RewriteAction, RewriteFieldContext, RewriteSelection } from './types'
import { useCallback, useEffect, useRef } from 'react'
import { runBulletRewrite } from '@/lib/llm'
import { parseRewriteResponse } from './parse-rewrite-response'
import { useRewriteSession } from './use-rewrite-session'

interface Args {
  fieldContext: RewriteFieldContext
}

export function useAiRewrite({ fieldContext }: Args) {
  const session = useRewriteSession()
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // 依赖 session 整体引用：每次 setState 后 session.state 会变，闭包内通过新一轮 useCallback 拿到最新 jdDraft。
  const run = useCallback(async (action: RewriteAction, selection: RewriteSelection) => {
    cancel()
    const controller = new AbortController()
    abortRef.current = controller

    session.startStreaming(action)

    try {
      const { content } = await runBulletRewrite(
        {
          action,
          selectionText: selection.text,
          selectionHtml: selection.html,
          fieldContext,
          jdDraft: action === 'align_jd' ? session.state.jdDraft : undefined,
        },
        undefined,
        { abortController: controller },
      )
      if (controller.signal.aborted)
        return
      const candidates = parseRewriteResponse(content, action)
      session.succeed(candidates)
    }
    catch (err) {
      if (controller.signal.aborted)
        return
      const message = err instanceof Error ? err.message : 'AI 改写失败'
      const isAuth = message.includes('用户未登录')
      session.fail(isAuth ? '请先登录后再使用 AI 改写' : message)
    }
    finally {
      if (abortRef.current === controller)
        abortRef.current = null
    }
  }, [cancel, fieldContext, session])

  useEffect(() => () => cancel(), [cancel])

  const action = session.state.action
  const retry = useCallback((selection: RewriteSelection) => {
    if (action) {
      return run(action, selection)
    }
  }, [action, run])

  const waitForJd = useCallback(() => {
    cancel()
    session.waitForJd()
  }, [cancel, session])

  return {
    state: session.state,
    setJdDraft: session.setJdDraft,
    run,
    retry,
    cancel,
    reset: session.reset,
    waitForJd,
  }
}
