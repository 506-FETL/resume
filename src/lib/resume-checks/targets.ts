import type { ORDERType } from '@/lib/schema'
import type {
  CheckPatch,
  CheckSnapshot,
  CheckTarget,
  ResumeCheckIssue,
} from './types'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { isCheckTermStyleChange } from './terms'

const excludedKeys = new Set(['entryId', 'hidden', 'photo', 'displayType'])
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

export function isCheckSectionVisible(
  snapshot: CheckSnapshot,
  section: ORDERType,
): boolean {
  return (
    section === 'basics' ||
    (snapshot.visibility?.[section] !== true &&
      (!snapshot.order || snapshot.order.includes(section)))
  )
}

/** 保留稳定条目身份；路径相对于模块，quote 只包含实际显示的文字。 */
export function collectCheckFields(snapshot: CheckSnapshot): CheckTarget[] {
  const fields: CheckTarget[] = []

  const visit = (
    section: ORDERType,
    value: unknown,
    path: string,
    entryId?: string,
  ) => {
    if (typeof value === 'string') {
      const quote = resumeHtmlToText(value).trim()

      if (!quote) return
      if (
        quote === '不填' &&
        /\/(gender|workYears|maritalStatus|politicalStatus|degree|dateEntry)$/.test(
          path,
        )
      )
        return

      fields.push({ section, path, quote, ...(entryId ? { entryId } : {}) })

      return
    }
    if (!value || typeof value !== 'object') return

    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        const item = child as { hidden?: boolean; entryId?: string } | null

        if (item?.hidden === true) return

        const id = typeof item?.entryId === 'string' ? item.entryId : undefined

        visit(section, child, `${path}/${id ? `@${id}` : index}`, id ?? entryId)
      })

      return
    }

    Object.entries(value).forEach(([key, child]) => {
      if (!excludedKeys.has(key))
        visit(section, child, `${path}/${key}`, entryId)
    })
  }

  const sections = new Set<ORDERType>(['basics', ...(snapshot.order ?? [])])

  sections.forEach((section) => {
    if (isCheckSectionVisible(snapshot, section)) {
      visit(section, snapshot[section], '')
    }
  })

  return fields
}

function locateTarget(snapshot: CheckSnapshot, target: CheckTarget) {
  if (!isCheckSectionVisible(snapshot, target.section)) return null
  if (!target.path.startsWith('/')) return null

  let value: unknown = snapshot[target.section]
  const keys: (string | number)[] = []

  for (const part of target.path.slice(1).split('/')) {
    if (unsafeKeys.has(part) || excludedKeys.has(part)) return null
    if (!value || typeof value !== 'object') return null
    if ('hidden' in value && value.hidden === true) return null

    let key: string | number = part

    if (Array.isArray(value)) {
      if (part.startsWith('@')) {
        const matches = value
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item?.entryId === part.slice(1))

        if (matches.length !== 1) return null

        key = matches[0].index
      } else {
        if (!/^(0|[1-9]\d*)$/.test(part)) return null

        key = Number(part)

        // 有稳定身份的条目不得退回数组下标，避免重排后写到另一条。
        if (value[key]?.entryId) return null
      }
    }

    if (!Object.hasOwn(value, key)) return null

    keys.push(key)
    value = (value as Record<string | number, unknown>)[key]
  }

  if (typeof value !== 'string') return null
  if (
    target.entryId &&
    !keys.some((_, i) => target.path.split('/')[i + 1] === `@${target.entryId}`)
  )
    return null

  return { value, keys }
}

export function readCheckTarget(
  snapshot: CheckSnapshot,
  target: CheckTarget,
): string | null {
  return locateTarget(snapshot, target)?.value ?? null
}

/** 完整字段签名不受目标排列与条目重排影响，字段任意修改都会使确认过期。 */
export function checkIssueSignature(
  snapshot: CheckSnapshot,
  targets: CheckTarget[],
): string {
  const values = new Map<string, [ORDERType, string, string | null]>()

  targets.forEach((target) => {
    values.set(JSON.stringify([target.section, target.path]), [
      target.section,
      target.path,
      readCheckTarget(snapshot, target),
    ])
  })

  return JSON.stringify(
    [...values.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value),
  )
}

function replaceText(
  raw: string,
  targets: CheckTarget[],
  replacement: string,
): string | null {
  const rich = /<\/?[a-z][^>]*>/i.test(raw)

  if (!rich) {
    // entity 或字面 HTML 经预览解码后可能不同，此时不猜测映射。
    if (resumeHtmlToText(raw) !== raw.trim()) return null

    let next = raw

    for (const target of [...targets].sort(
      (a, b) => (b.occurrence ?? 0) - (a.occurrence ?? 0),
    )) {
      const positions = [
        ...raw.matchAll(new RegExp(escapePattern(target.quote), 'g')),
      ].map((match) => match.index)

      const position = positions[target.occurrence ?? 0]

      if (position === undefined) return null

      next =
        next.slice(0, position) +
        replacement +
        next.slice(position + target.quote.length)
    }

    return next
  }

  const document = new DOMParser().parseFromString(raw, 'text/html')

  if (document.querySelector('script,style,template')) return null

  const walker = document.createTreeWalker(document.body, 4)
  const nodes: Text[] = []

  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  const changes = new Map<Text, { start: number; length: number }[]>()

  for (const target of targets) {
    const rendered = resumeHtmlToText(raw)

    const occurrences = [
      ...rendered.matchAll(new RegExp(escapePattern(target.quote), 'g')),
    ]

    const candidates = nodes.flatMap((node) =>
      [
        ...(node.textContent ?? '').matchAll(
          new RegExp(escapePattern(target.quote), 'g'),
        ),
      ].map((match) => ({ node, start: match.index })),
    )

    // 一个出现位置跨越多个文本节点时，禁止把后续同词的位置错当成它。
    if (occurrences.length !== candidates.length) return null

    const candidate = candidates[target.occurrence ?? 0]

    if (!candidate) return null

    const entries = changes.get(candidate.node) ?? []

    entries.push({ start: candidate.start, length: target.quote.length })
    changes.set(candidate.node, entries)
  }

  changes.forEach((entries, node) => {
    let text = node.textContent ?? ''

    entries
      .sort((a, b) => b.start - a.start)
      .forEach(({ start, length }) => {
        text = text.slice(0, start) + replacement + text.slice(start + length)
      })

    node.textContent = text
  })

  return document.body.innerHTML
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 只产生补丁，不写入状态；调用者仍需在真正写入前核验 before。 */
export function createCheckPatch(
  snapshot: CheckSnapshot,
  issue: ResumeCheckIssue,
): CheckPatch[] | null {
  if (!['term', 'spelling'].includes(issue.kind)) return null
  if (!issue.replacement?.trim() || !issue.targets.length) return null
  if (
    issue.targets.some((target) =>
      isCheckTermStyleChange(target.quote, issue.replacement!),
    )
  )
    return null
  if (/[<>&]/.test(issue.replacement)) return null
  if (
    issue.targets.some((target) =>
      /\/(?:birthMonth|(?:work|internship|project)?[Dd]uration)(?:\/|$)/.test(
        target.path,
      ),
    )
  )
    return null
  if (
    /\d/.test(issue.replacement) ||
    issue.targets.some((target) => !target.quote || /\d/.test(target.quote))
  )
    return null
  if (checkIssueSignature(snapshot, issue.targets) !== issue.signature)
    return null

  const groups = new Map<string, CheckTarget[]>()

  for (const target of issue.targets) {
    const key = JSON.stringify([target.section, target.path])
    const group = groups.get(key) ?? []

    if (
      !group.some(
        (entry) =>
          entry.quote === target.quote &&
          (entry.occurrence ?? 0) === (target.occurrence ?? 0),
      )
    )
      group.push(target)

    groups.set(key, group)
  }

  const sections = new Map<ORDERType, CheckPatch>()

  for (const targets of groups.values()) {
    const target = targets[0]
    const located = locateTarget(snapshot, target)

    if (!located) return null
    if (targets.some((entry) => entry.quote !== target.quote)) return null

    const next = replaceText(located.value, targets, issue.replacement)

    if (next === null || next === located.value) return null

    const patch = sections.get(target.section) ?? {
      section: target.section,
      before: snapshot[target.section],
      after: structuredClone(snapshot[target.section]),
    }

    let parent = patch.after as unknown as Record<string | number, unknown>

    located.keys.slice(0, -1).forEach((key) => {
      parent = parent[key] as Record<string | number, unknown>
    })

    parent[located.keys.at(-1)!] = next
    sections.set(target.section, patch)
  }

  return [...sections.values()]
}
