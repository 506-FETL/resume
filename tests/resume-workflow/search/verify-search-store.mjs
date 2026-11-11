import assert from 'node:assert/strict'
import { fixture, records } from './store-fixture.mjs'

const results = []

async function check(name, run) {
  await run()
  results.push(name)
  process.stdout.write(`PASS ${name}\n`)
}

function ids(subject) {
  return subject.store.getState().libraryItems.map((item) => item.resume_id)
}

function noReadsOrLoading(subject) {
  assert.deepEqual(subject.calls, [])
  assert.ok(subject.events.every((event) => !event.loading))
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return

    await new Promise((resolve) => setImmediate(resolve))
  }

  throw new Error('Condition did not settle')
}

await check(
  '未完整加载时按名称和描述搜到云端及本地末页，不用当前页代替全库',
  async () => {
    const items = records(23, { mixed: true })

    items[0].display_name = 'Alpha 作品'
    items[12].description = '描述中的 ALPHA'
    items[22].description = '末页本地 alpha'

    const subject = await fixture(items)

    await subject.store.getState().loadLibraryPage(1)

    const counts = subject.store.getState().libraryCounts

    subject.resetObservations()
    await subject.search('  aLpHa  ')
    assert.equal(subject.store.getState().libraryQuery, 'alpha')

    assert.deepEqual(ids(subject), [
      'record-000',
      'record-012',
      'local-record-022',
    ])

    assert.equal(subject.store.getState().libraryTotal, 3)
    assert.equal(subject.store.getState().libraryCounts, counts)

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'counts' && call.query === 'alpha',
      ),
    )

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'page' && call.query === 'alpha',
      ),
    )
  },
)

await check(
  '23条混合搜索结果保持10/10/3、无重复遗漏，回页与清空回词零读取',
  async () => {
    const subject = await fixture(records(23, { mixed: true }))

    await subject.store.getState().loadLibraryPage(1)
    await subject.search('摘要')

    const visited = [...ids(subject)]

    for (const page of [2, 3]) {
      await subject.store.getState().loadLibraryPage(page)
      assert.equal(ids(subject).length, page === 2 ? 10 : 3)
      visited.push(...ids(subject))
    }

    assert.deepEqual(
      visited,
      subject.data.items.map((item) => item.resume_id),
    )

    assert.ok(
      subject.calls
        .filter((call) => call.kind === 'page' || call.kind === 'local')
        .every((call) => call.size <= 10),
    )

    subject.resetObservations()
    await subject.store.getState().loadLibraryPage(2)
    await subject.search('')
    await subject.search('摘要')
    await subject.store.getState().loadLibraryPage(3)
    noReadsOrLoading(subject)
  },
)

await check(
  '完整全库摘要推导搜索、分类、零结果和特殊字面字符，全部零读取',
  async () => {
    const items = records(23, { mixed: true })

    items[12].description = `云端 %_,'"\\ 片段 中文 Rust`
    items[22].description = `本地 %_,'"\\ 片段`

    const subject = await fixture(items)

    for (const page of [1, 2, 3])
      await subject.store.getState().loadLibraryPage(page)

    subject.resetObservations()
    await subject.search(`%_,'"\\`)
    assert.deepEqual(ids(subject), ['record-012', 'local-record-022'])
    await subject.filter('variants')
    assert.deepEqual(ids(subject), ['local-record-022'])
    await subject.filter('roots')
    assert.deepEqual(ids(subject), ['record-012'])
    await subject.search(' 中文 RUST ')
    assert.deepEqual(ids(subject), ['record-012'])
    await subject.search('没有这个片段')
    assert.equal(subject.store.getState().libraryTotal, 0)
    assert.deepEqual(ids(subject), [])
    assert.equal(subject.store.getState().libraryCounts.all, 23)
    await subject.search('')
    await subject.filter('all')
    noReadsOrLoading(subject)
  },
)

await check(
  '搜索与分类相交，切换不完整分类需补查，完成分类回切复用',
  async () => {
    const subject = await fixture(records(23, { mixed: true }))

    await subject.store.getState().loadLibraryPage(1)
    await subject.search('摘要')
    subject.resetObservations()
    await subject.filter('variants')
    assert.equal(subject.store.getState().libraryTotal, 6)

    assert.ok(
      subject.store
        .getState()
        .libraryItems.every(
          (item) => item.parent_resume_id && item.derived_status === 'ready',
        ),
    )

    assert.ok(
      subject.calls.some(
        (call) =>
          call.kind === 'page' &&
          call.filter === 'variants' &&
          call.query === '摘要',
      ),
    )

    subject.resetObservations()
    await subject.filter('all')
    await subject.filter('variants')
    noReadsOrLoading(subject)
  },
)

await check(
  '零匹配成功缓存，失败统计不缓存空，摘要失败保留原结果并重试',
  async () => {
    const subject = await fixture(records(23))

    await subject.store.getState().loadLibraryPage(1)

    const previous = subject.store.getState().libraryItems

    subject.data.failCounts = true
    await subject.search('missing')
    assert.equal(subject.store.getState().libraryError, 'counts failed')
    assert.equal(subject.store.getState().libraryItems, previous)
    assert.equal(subject.store.getState().libraryTotal, null)
    subject.resetObservations()
    await subject.store.getState().loadLibraryPage(1)
    assert.equal(subject.store.getState().libraryError, null)
    assert.equal(subject.store.getState().libraryTotal, 0)

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'counts' && call.query === 'missing',
      ),
    )

    await subject.search('')
    subject.resetObservations()
    await subject.search('missing')
    noReadsOrLoading(subject)
    await subject.search('')
    subject.data.failPage = true
    await subject.search('摘要')
    assert.equal(subject.store.getState().libraryError, 'page failed')
    assert.equal(subject.store.getState().libraryItems, previous)
    await subject.store.getState().loadLibraryPage(1)
    assert.equal(subject.store.getState().libraryError, null)
    assert.equal(subject.store.getState().libraryItems.length, 10)
  },
)

await check(
  '在途查询A→B→A共享请求，旧查询和finally不污染当前结果',
  async () => {
    const subject = await fixture(records(23))

    await subject.store.getState().loadLibraryPage(1)
    subject.resetObservations()
    subject.data.pausedQuery = '摘要'

    const first = subject.search('摘要')

    await waitFor(() => subject.data.release)
    await subject.search('描述 22')
    assert.deepEqual(ids(subject), ['record-022'])

    const again = subject.search('摘要')

    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(
      subject.calls.filter(
        (call) => call.kind === 'page' && call.query === '摘要',
      ).length,
      1,
    )

    assert.equal(
      subject.calls.filter(
        (call) => call.kind === 'counts' && call.query === '摘要',
      ).length,
      1,
    )

    assert.equal(subject.store.getState().libraryLoading, true)
    subject.data.release()
    await Promise.all([first, again])
    assert.equal(subject.store.getState().libraryLoading, false)
    assert.equal(subject.store.getState().libraryQuery, '摘要')
    assert.equal(ids(subject).length, 10)
  },
)

await check('离开慢查询后完成只预备其缓存，不覆盖已清空的列表', async () => {
  const subject = await fixture(records(23))

  await subject.store.getState().loadLibraryPage(1)
  subject.data.pausedQuery = '描述 22'

  const pending = subject.search('描述 22')

  await waitFor(() => subject.data.release)
  await subject.search('')

  const current = subject.store.getState().libraryItems

  subject.data.release()
  await pending
  assert.equal(subject.store.getState().libraryItems, current)
  assert.equal(subject.store.getState().libraryLoading, false)
  subject.resetObservations()
  await subject.search('描述 22')
  assert.deepEqual(ids(subject), ['record-022'])
  noReadsOrLoading(subject)
})

await check(
  '修改名称描述后全部查询失效，当前查询保留并显示新的匹配',
  async () => {
    const subject = await fixture(records(23))

    await subject.store.getState().loadLibraryPage(1)
    await subject.search('changed')
    assert.deepEqual(ids(subject), [])
    subject.data.items[22].description = 'new CHANGED description'
    subject.resetObservations()
    await subject.store.getState().invalidateLibrary()
    assert.equal(subject.store.getState().libraryQuery, 'changed')
    assert.deepEqual(ids(subject), ['record-022'])

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'counts' && call.query === 'changed',
      ),
    )

    subject.resetObservations()
    await subject.search('')

    assert.ok(
      subject.calls.some((call) => call.kind === 'page' && call.query === ''),
    )
  },
)

await check('账户A→B→A清空搜索与全部查询缓存，旧请求无回填', async () => {
  const subject = await fixture(records(23))

  await subject.store.getState().loadLibraryPage(1)
  subject.data.pausedQuery = '摘要'

  const pending = subject.search('摘要')

  await waitFor(() => subject.data.release)
  subject.data.owner = 'B'
  subject.data.pausedQuery = null
  subject.data.items = [{ ...records(1)[0], resume_id: 'B' }]
  subject.store.getState().resetLibraryAccount('B')
  await subject.store.getState().loadLibraryPage(1)
  subject.data.release()
  await pending
  assert.deepEqual(ids(subject), ['B'])
  assert.equal(subject.store.getState().libraryQuery, '')
  assert.equal(subject.store.getState().librarySearchInput, '')
  subject.data.owner = 'A'
  subject.data.items = [{ ...records(1)[0], resume_id: 'A-new' }]
  subject.store.getState().resetLibraryAccount('A')
  subject.resetObservations()
  await subject.store.getState().loadLibraryPage(1)
  assert.deepEqual(ids(subject), ['A-new'])

  assert.ok(
    subject.calls.some((call) => call.kind === 'counts' && call.owner === 'A'),
  )
})

await check('查询不裁剪全库同步候选与任务统计', async () => {
  const subject = await fixture(records(23, { mixed: true }))

  await subject.store.getState().loadLibraryPage(1)

  const offlineCount = subject.data.items.filter(
    (item) => item.isOffline,
  ).length

  const pendingCount = subject.store.getState().libraryCounts.pending

  await subject.search('none')
  await subject.store.getState().loadLibraryOfflineOptions()
  assert.equal(subject.store.getState().offlineResumes.length, offlineCount)
  assert.equal(subject.store.getState().libraryCounts.offline, offlineCount)
  assert.equal(subject.store.getState().libraryCounts.pending, pendingCount)
})

process.stdout.write(
  `${JSON.stringify({ passed: results.length, cases: results }, null, 2)}\n`,
)
