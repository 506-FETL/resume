import { redactShareContacts } from '../../../supabase/functions/shared/resume-share-privacy'
import { redactHiddenResumeSections } from '../../../supabase/functions/shared/resume-share-redaction'
import { fixtureSnapshot } from './fixture-snapshot.mjs'
import templateResource from './template-resource.json'

const memory = new Map<string, string>()

const storage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  getItem: (key) => memory.get(key) ?? null,
  removeItem: (key) => memory.delete(key),
  setItem: (key, value) => memory.set(key, value),
}

Object.defineProperty(window, 'localStorage', { value: storage })
Object.defineProperty(window, 'sessionStorage', { value: storage })

const definition = JSON.parse(templateResource.content)

const binding = {
  source: 'official',
  templateId: definition.templateId,
  templateVersion: definition.version,
}

const manifest = {
  schemaVersion: 3,
  templateId: definition.templateId,
  templateVersion: definition.version,
  definition,
  assets: definition.assets,
}

const originalFetch = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    window.location.href,
  )

  if (url.origin === window.location.origin) return originalFetch(input, init)
  if (url.pathname !== '/functions/v1/resume-share')
    throw new Error('分享隐私样本禁止外部数据请求')

  const body = JSON.parse(String(init?.body ?? '{}'))

  if (body.op) throw new Error('分享隐私样本禁止外部写入')

  const [mode, length = 'short'] = String(body.token).split('--')
  const source = fixtureSnapshot(binding)

  if (mode === 'empty') {
    source.basics.phone = ''
    source.basics.email = ''
  }
  if (length === 'long' || length === 'boundary') {
    const paragraphs = length === 'long' ? 65 : 23

    source.work_experience.items[0].workInfo = Array.from(
      { length: paragraphs },
      (_, index) =>
        `<p>合成工作说明 ${index + 1}：与团队合作维护业务界面，核对交互、可访问性与交付结果。</p>`,
    ).join('')
  }

  const showPhone = mode === 'show' || mode === 'email'
  const showEmail = mode === 'show' || mode === 'phone'

  const snapshot = redactShareContacts(redactHiddenResumeSections(source), {
    purpose: 'showcase',
    show_phone: showPhone,
    show_email: showEmail,
  })

  const revision = `fixture-${body.token}`
  const notModified = body.knownContentRevision === revision

  return Response.json(
    {
      source_kind: 'current',
      content_revision: revision,
      not_modified: notModified,
      ...(notModified ? {} : { snapshot, template_manifest: manifest }),
      display_name: '合成分享简历',
      share_id: '11111111-1111-4111-8111-111111111111',
      release_id: '22222222-2222-4222-8222-222222222222',
      release_no: 1,
      version_id: 1,
      document_revision: 1,
      projection_reference_date: '2026-11-11',
      allow_comments: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

await import(
  /* @vite-ignore */ new URL('./render.tsx?revision=1', import.meta.url).href
)
