import type { RewriteAction, RewriteCandidate } from '../types'
import { parseLlmJsonObject } from '@/lib/llm'
import { REWRITE_ACTION_META } from '../const'

interface RawCandidate {
  title?: unknown
  html?: unknown
  notes?: unknown
}

interface RawShape {
  candidates?: unknown
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `cand_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function parseRewriteResponse(raw: string, action: RewriteAction): RewriteCandidate[] {
  const obj = parseLlmJsonObject<RawShape>(raw)
  const list = Array.isArray(obj.candidates) ? obj.candidates : []

  if (list.length === 0) {
    throw new Error('LLM 未返回任何候选')
  }

  const seenTitles = new Set<string>()
  const candidates: RewriteCandidate[] = []

  list.forEach((item, index) => {
    const c = item as RawCandidate
    const html = typeof c.html === 'string' ? c.html.trim() : ''

    if (!html)
      return

    let title = typeof c.title === 'string' && c.title.trim()
      ? c.title.trim().slice(0, 10)
      : `${REWRITE_ACTION_META[action].label}候选 #${index + 1}`

    if (seenTitles.has(title)) {
      title = `${title} #${index + 1}`
    }
    seenTitles.add(title)

    const notes = typeof c.notes === 'string' ? c.notes.trim().slice(0, 200) : undefined

    candidates.push({ id: generateId(), title, html, notes })
  })

  if (candidates.length === 0) {
    throw new Error('LLM 候选 html 全部为空')
  }

  if (candidates.length < 2) {
    throw new Error('LLM 返回的有效候选少于 2 个')
  }

  return candidates.slice(0, 3)
}
