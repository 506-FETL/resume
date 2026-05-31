import type { RewriteAction, RewriteFieldContext, RewriteSelection } from '../types'
import { useEffect, useRef } from 'react'
import { runBulletRewrite } from '@/lib/llm'
import { parseRewriteResponse } from '../utils/parse-rewrite-response'
import { useRewriteSession } from './use-rewrite-session'

interface Args {
  fieldContext: RewriteFieldContext
}

export function useAiRewrite({ fieldContext }: Args) {
  const session = useRewriteSession()
  const abortRef = useRef<AbortController | null>(null)

  function cancel() {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }

  async function run(action: RewriteAction, selection: RewriteSelection) {
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
  }

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  function retry(selection: RewriteSelection) {
    if (session.state.action) {
      return run(session.state.action, selection)
    }
  }

  function waitForJd() {
    cancel()
    session.waitForJd()
  }

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
