/// <reference types="node" />
/* eslint-disable test/no-import-node-test */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  failRewriteSession,
  getRewriteCanRetry,
  INITIAL_REWRITE_SESSION_STATE,
  setRewriteJdDraft,
  startRewriteStreaming,
  succeedRewriteSession,
  waitForRewriteJd,
} from './rewrite-session-state.ts'

const candidate = {
  id: 'candidate-1',
  title: '结果版本',
  html: '<p>改写结果</p>',
}

describe('rewrite session state', () => {
  it('会用 waiting_jd 明确表示 JD 待填写状态', () => {
    const state = waitForRewriteJd(INITIAL_REWRITE_SESSION_STATE)

    assert.equal(state.status, 'waiting_jd')
    assert.equal(state.action, 'align_jd')
    assert.deepEqual(state.candidates, [])
    assert.equal(state.errorMessage, null)
  })

  it('会根据 JD 字数判断 align_jd 是否可以重试', () => {
    const waitingState = waitForRewriteJd(INITIAL_REWRITE_SESSION_STATE)

    assert.equal(getRewriteCanRetry(waitingState, 10), false)
    assert.equal(getRewriteCanRetry(setRewriteJdDraft(waitingState, '岗位描述内容已经足够长'), 10), true)
  })

  it('会在 streaming、success、error 之间清理候选和错误', () => {
    const streaming = startRewriteStreaming(INITIAL_REWRITE_SESSION_STATE, 'polish')
    const success = succeedRewriteSession(streaming, [candidate])
    const failed = failRewriteSession(success, 'AI 改写失败')

    assert.equal(streaming.status, 'streaming')
    assert.deepEqual(streaming.candidates, [])
    assert.equal(success.status, 'success')
    assert.deepEqual(success.candidates, [candidate])
    assert.equal(failed.status, 'error')
    assert.deepEqual(failed.candidates, [])
    assert.equal(failed.errorMessage, 'AI 改写失败')
  })

  it('streaming 时不会允许重复重试', () => {
    const streaming = startRewriteStreaming(INITIAL_REWRITE_SESSION_STATE, 'polish')

    assert.equal(getRewriteCanRetry(streaming, 10), false)
  })
})
