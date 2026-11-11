import assert from 'node:assert/strict'
import {
  fixture,
  records,
} from '../../resume-workflow/search/store-fixture.mjs'

const results = []

function noReadsOrLoading(subject) {
  assert.deepEqual(subject.calls, [])
  assert.ok(subject.events.every((event) => !event.loading))
}

async function check(name, run) {
  await run()
  results.push(name)
  process.stdout.write(`PASS ${name}\n`)
}

if (process.argv.includes('--baseline')) {
  const subject = await fixture(records(2))

  await subject.store.getState().loadLibraryPage(1)
  subject.resetObservations()
  await subject.filter('roots')
  await subject.filter('variants')
  await subject.filter('all')

  process.stdout.write(
    `${JSON.stringify({ calls: subject.calls, events: subject.events }, null, 2)}\n`,
  )

  process.exit(0)
}

await check(
  '两份原始简历：全部 / 原始 / 岗位首次切换零读取、零 loading',
  async () => {
    const subject = await fixture(records(2))

    await subject.store.getState().loadLibraryPage(1)
    subject.resetObservations()
    await subject.filter('roots')
    assert.equal(subject.store.getState().libraryItems.length, 2)
    await subject.filter('variants')
    assert.equal(subject.store.getState().libraryItems.length, 0)
    assert.equal(subject.store.getState().libraryTotal, 0)
    await subject.filter('all')
    assert.equal(subject.store.getState().libraryItems.length, 2)
    noReadsOrLoading(subject)
  },
)

await check('23份同类结果：共享页游标，缺页才读取，10 / 10 / 3', async () => {
  const subject = await fixture(records(23))

  await subject.store.getState().loadLibraryPage(1)
  subject.resetObservations()
  await subject.filter('roots')
  noReadsOrLoading(subject)
  await subject.store.getState().loadLibraryPage(2)
  assert.equal(subject.store.getState().libraryItems.length, 10)

  assert.deepEqual(
    subject.calls
      .filter((call) => call.kind === 'page')
      .map(({ offset, size }) => [offset, size]),
    [[10, 10]],
  )

  subject.resetObservations()
  await subject.filter('all')
  await subject.store.getState().loadLibraryPage(2)
  noReadsOrLoading(subject)
  await subject.store.getState().loadLibraryPage(3)
  assert.equal(subject.store.getState().libraryItems.length, 3)

  assert.deepEqual(
    subject.calls
      .filter((call) => call.kind === 'page')
      .map(({ offset, size }) => [offset, size]),
    [[20, 10]],
  )
})

await check(
  '完整混合集合：跨三页推导原始及ready岗位页，不包含失败版本',
  async () => {
    const subject = await fixture(records(23, { mixed: true }))
    const visited = []

    for (const page of [1, 2, 3]) {
      await subject.store.getState().loadLibraryPage(page)

      visited.push(
        ...subject.store.getState().libraryItems.map((item) => item.resume_id),
      )
    }

    assert.deepEqual(
      visited,
      subject.data.items.map((item) => item.resume_id),
    )

    subject.resetObservations()
    await subject.filter('roots')

    const roots = [...subject.store.getState().libraryItems]

    await subject.store.getState().loadLibraryPage(2)
    roots.push(...subject.store.getState().libraryItems)

    assert.deepEqual(
      roots.map((item) => item.resume_id),
      [
        'record-000',
        'local-record-002',
        'record-003',
        'record-005',
        'local-record-006',
        'record-008',
        'record-011',
        'record-012',
        'record-015',
        'record-017',
        'local-record-018',
        'record-020',
        'record-021',
      ],
    )

    await subject.filter('variants')

    assert.deepEqual(
      subject.store.getState().libraryItems.map((item) => item.resume_id),
      [
        'record-001',
        'record-007',
        'local-record-010',
        'record-013',
        'record-016',
        'local-record-022',
      ],
    )

    noReadsOrLoading(subject)
  },
)

await check(
  '不完整全部页不能代替筛选全量，失败可重试且不缓存空结果',
  async () => {
    const subject = await fixture(records(23, { mixed: true }))

    await subject.store.getState().loadLibraryPage(1)

    const previous = subject.store.getState().libraryItems

    subject.data.failPage = true
    subject.resetObservations()
    await subject.filter('roots')
    assert.equal(subject.store.getState().libraryError, 'page failed')
    assert.equal(subject.store.getState().libraryItems, previous)

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'page' && call.filter === 'roots',
      ),
    )

    await subject.store.getState().loadLibraryPage(1)
    assert.equal(subject.store.getState().libraryError, null)
    assert.equal(subject.store.getState().libraryItems.length, 10)

    assert.equal(
      subject.calls.filter(
        (call) => call.kind === 'page' && call.filter === 'roots',
      ).length,
      2,
    )

    subject.resetObservations()
    await subject.filter('all')
    noReadsOrLoading(subject)
  },
)

await check('父摘要失败的全部页不能推导新筛选缓存', async () => {
  const subject = await fixture(records(6, { mixed: true }))

  subject.data.failParents = true
  await subject.store.getState().loadLibraryPage(1)
  assert.equal(subject.store.getState().libraryError, 'parents failed')
  subject.resetObservations()
  await subject.filter('variants')

  assert.ok(
    subject.calls.some(
      (call) => call.kind === 'page' && call.filter === 'variants',
    ),
  )

  assert.equal(subject.store.getState().libraryError, null)

  assert.deepEqual(
    subject.store.getState().libraryItems.map((item) => item.resume_id),
    ['record-001'],
  )
})

await check('统计失败不能推断空筛选，重试重新读取统计', async () => {
  const subject = await fixture(records(2))

  subject.data.failCounts = true
  await subject.store.getState().loadLibraryPage(1)
  assert.equal(subject.store.getState().libraryError, 'counts failed')
  subject.resetObservations()
  await subject.filter('variants')
  assert.ok(subject.calls.some((call) => call.kind === 'counts'))
  assert.equal(subject.store.getState().libraryError, null)
  assert.equal(subject.store.getState().libraryItems.length, 0)
})

await check('写入失效后重读，新类别不复用旧的空结果', async () => {
  const subject = await fixture(records(2))

  await subject.store.getState().loadLibraryPage(1)
  await subject.filter('variants')

  subject.data.items.push({
    ...records(1, { variantsOnly: true })[0],
    resume_id: 'new-variant',
  })

  subject.resetObservations()
  await subject.store.getState().invalidateLibrary()
  assert.ok(subject.calls.some((call) => call.kind === 'counts'))
  assert.equal(subject.store.getState().libraryTotal, 1)

  assert.equal(
    subject.store.getState().libraryItems[0].resume_id,
    'new-variant',
  )
})

await check('在途筛选快速返回缓存，迟到结果不覆盖当前页', async () => {
  const subject = await fixture(records(23, { mixed: true }))

  await subject.store.getState().loadLibraryPage(1)

  const previous = subject.store.getState().libraryItems

  subject.data.pausedFilter = 'roots'
  subject.store.getState().setLibraryFilter('roots')

  while (!subject.data.release)
    await new Promise((resolve) => setImmediate(resolve))

  subject.resetObservations()
  await subject.filter('all')
  assert.equal(subject.store.getState().libraryItems, previous)
  assert.deepEqual(subject.calls, [])
  assert.equal(subject.store.getState().libraryLoading, false)
  subject.data.release()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(subject.store.getState().filterMode, 'all')
  assert.equal(subject.store.getState().libraryItems, previous)
})

await check(
  '账户 A→B→A 清除共享缓存，旧请求与 finally 不污染新账户',
  async () => {
    const subject = await fixture(records(23))

    await subject.store.getState().loadLibraryPage(1)
    await subject.filter('roots')
    subject.data.pausedFilter = 'roots'

    const oldRequest = subject.store.getState().loadLibraryPage(2)

    while (!subject.data.release)
      await new Promise((resolve) => setImmediate(resolve))

    subject.data.owner = 'B'
    subject.data.items = [{ ...records(1)[0], resume_id: 'B-record' }]
    subject.data.pausedFilter = null
    subject.store.getState().resetLibraryAccount('B')
    await subject.store.getState().loadLibraryPage(1)
    subject.data.release()
    await oldRequest
    assert.equal(subject.store.getState().libraryItems[0].resume_id, 'B-record')
    assert.equal(subject.store.getState().libraryLoading, false)
    subject.data.owner = 'A'
    subject.data.items = [{ ...records(1)[0], resume_id: 'A-updated' }]
    subject.store.getState().resetLibraryAccount('A')
    subject.resetObservations()
    await subject.store.getState().loadLibraryPage(1)

    assert.ok(
      subject.calls.some(
        (call) => call.kind === 'counts' && call.owner === 'A',
      ),
    )

    assert.equal(
      subject.store.getState().libraryItems[0].resume_id,
      'A-updated',
    )
  },
)

await check('全部为ready岗位版本时共享分页，原始分类零请求为空', async () => {
  const subject = await fixture(records(23, { variantsOnly: true }))

  await subject.store.getState().loadLibraryPage(1)
  subject.resetObservations()
  await subject.filter('variants')
  assert.equal(subject.store.getState().libraryItems.length, 10)
  await subject.filter('roots')
  assert.equal(subject.store.getState().libraryItems.length, 0)
  await subject.filter('all')
  noReadsOrLoading(subject)
})

await check('从原始分类进入页面后首次切全部，等价结果反向复用', async () => {
  const subject = await fixture(records(23))

  subject.store.setState({ filterMode: 'roots' })
  await subject.store.getState().loadLibraryPage(1)
  subject.resetObservations()
  await subject.filter('all')
  noReadsOrLoading(subject)
  await subject.store.getState().loadLibraryPage(2)

  assert.deepEqual(
    subject.calls
      .filter((call) => call.kind === 'page')
      .map(({ offset, size }) => [offset, size]),
    [[10, 10]],
  )
})

await check('直接跳末页的中间页未补齐父摘要，不当作完整全部缓存', async () => {
  const subject = await fixture(records(23, { mixed: true }))

  await subject.store.getState().loadLibraryPage(3)
  subject.resetObservations()
  await subject.filter('roots')

  assert.ok(
    subject.calls.some(
      (call) => call.kind === 'page' && call.filter === 'roots',
    ),
  )

  assert.equal(subject.store.getState().libraryItems.length, 10)
})

process.stdout.write(
  `${JSON.stringify({ passed: results.length, cases: results }, null, 2)}\n`,
)
