import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loadSource } from './load-source.mjs'

const calls = []
const owner = '00000000-0000-4000-8000-000000000101'

const counts = {
  all: 23,
  roots: 12,
  variants: 11,
  readyVariants: 10,
  pending: 1,
}

const row = {
  resume_id: '00000000-0000-4000-8000-000000000201',
  display_name: '合成简历',
  description: '仅用于查询协议验证',
  linked_jd_excerpt: '80字以内的片段',
  derived_match_rate: 82,
  template_binding: null,
}

let failed = false

const client = createClient('https://search-fixture.invalid', 'fixture-key', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (input, init) => {
      const url = new URL(String(input))
      const body = init?.body ? JSON.parse(init.body) : null

      calls.push({ url, body, method: init?.method })

      if (failed) {
        failed = false

        return new Response(
          JSON.stringify({ message: 'fixture unavailable', code: 'P0001' }),
          { status: 503 },
        )
      }

      return new Response(
        JSON.stringify(url.pathname.includes('counts') ? counts : [row]),
        { status: 200 },
      )
    },
  },
})

const api = await loadSource('src/lib/supabase/resume/library.ts', {
  '../client': { default: client },
})

await api.getResumeLibraryPage(owner, 'roots', 10, 50)

assert.equal(calls[0].url.pathname, '/rest/v1/resume_config')
assert.equal(calls[0].url.searchParams.get('limit'), '10')
assert.equal(calls[0].url.searchParams.get('offset'), '10')

assert.equal(
  calls[0].url.searchParams.get('order'),
  'updated_at.desc.nullslast,resume_id.desc',
)

assert.equal(calls[0].url.searchParams.get('parent_resume_id'), 'is.null')

assert.ok(
  calls[0].url.searchParams
    .get('select')
    .includes('linked_jd_excerpt:resume_jd_excerpt'),
)

assert.ok(
  calls[0].url.searchParams
    .get('select')
    .includes('derived_match_rate:derived_metadata->matchRate'),
)

await api.getResumeLibraryCounts(owner)
assert.equal(calls[1].url.pathname, '/rest/v1/rpc/get_resume_library_counts')
assert.deepEqual(calls[1].body, { p_owner_id: owner })

const query = `%_,'"\\中文 rust`
const items = await api.getResumeLibraryPage(owner, 'variants', 20, 100, query)
const call = calls[2]

assert.equal(call.method, 'POST')
assert.equal(call.url.pathname, '/rest/v1/rpc/search_resume_library_page')

assert.deepEqual(call.body, {
  p_owner_id: owner,
  p_query: query,
  p_filter: 'variants',
  p_offset: 20,
  p_limit: 10,
})

assert.equal(call.url.searchParams.has('or'), false)

assert.equal(
  call.url.searchParams.get('select'),
  'resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_excerpt,derived_match_rate,derived_status,template_binding',
)

assert.equal(items[0].derived_match_rate, 82)
assert.equal(items[0].linked_jd_excerpt, row.linked_jd_excerpt)
assert.equal(items[0].templateBinding, null)

await api.getResumeLibraryCounts(owner, query)
assert.equal(calls[3].url.pathname, '/rest/v1/rpc/search_resume_library_counts')
assert.deepEqual(calls[3].body, { p_owner_id: owner, p_query: query })
failed = true

await assert.rejects(api.getResumeLibraryPage(owner, 'all', 0, 10, query), {
  message: 'fixture unavailable',
})

failed = true

await assert.rejects(api.getResumeLibraryCounts(owner, query), {
  message: 'fixture unavailable',
})

process.stdout.write(
  `${JSON.stringify({ passed: 6, checks: ['旧表查询与排序/范围', '旧统计RPC', '搜索专用RPC字面参数', '11个摘要字段无正文/JD全文', '搜索统计参数', '失败抛出而非空数据'] }, null, 2)}\n`,
)
