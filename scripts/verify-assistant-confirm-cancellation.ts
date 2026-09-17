import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const server = await createServer({ server: { middlewareMode: true, watch: null, ws: false }, appType: 'custom' })

try {
  const { requestConfirm, setConfirmHandler } = await server.ssrLoadModule('/src/lib/ai/agent/confirm-bridge.ts')
  let handlerCalls = 0
  let applyCalls = 0
  const request = (id: string) => ({
    id,
    toolName: 'test-write',
    preview: { kind: 'resume-field' as const, title: '测试写入' },
    apply: async () => {
      applyCalls++
      return { ok: true }
    },
  })

  setConfirmHandler(async () => {
    handlerCalls++
    return { confirmed: true }
  })
  const stoppedBeforeConfirm = new AbortController()
  stoppedBeforeConfirm.abort()
  assert.deepEqual(await requestConfirm(request('before'), stoppedBeforeConfirm.signal), { cancelled: true })
  assert.equal(handlerCalls, 0)
  assert.equal(applyCalls, 0)

  assert.deepEqual(await requestConfirm(request('confirmed')), { ok: true })
  assert.equal(handlerCalls, 1)
  assert.equal(applyCalls, 1)

  setConfirmHandler(async () => ({ confirmed: false }))
  assert.deepEqual(await requestConfirm(request('rejected')), { cancelled: true })
  assert.equal(applyCalls, 1)

  setConfirmHandler((_request, signal) => new Promise((resolve) => {
    signal?.addEventListener('abort', () => resolve({ confirmed: false }), { once: true })
  }))
  const stoppedWhilePending = new AbortController()
  const pendingResult = requestConfirm(request('pending'), stoppedWhilePending.signal)
  stoppedWhilePending.abort()
  assert.deepEqual(await pendingResult, { cancelled: true })
  assert.equal(applyCalls, 1)

  const applyDone = deferred<void>()
  const applyStarted = deferred<void>()
  setConfirmHandler(async () => ({ confirmed: true }))
  const executingRequest = {
    ...request('applying'),
    apply: async () => {
      applyCalls++
      applyStarted.resolve()
      await applyDone.promise
      return { ok: true, persisted: true }
    },
  }
  const stoppedDuringApply = new AbortController()
  const executingResult = requestConfirm(executingRequest, stoppedDuringApply.signal)
  await applyStarted.promise
  stoppedDuringApply.abort()
  applyDone.resolve()
  assert.deepEqual(await executingResult, { ok: true, persisted: true })
  assert.equal(applyCalls, 2)

  setConfirmHandler(null)
  process.stdout.write('✓ 确认桥取消边界验证通过\n')
}
finally {
  await server.close()
}
