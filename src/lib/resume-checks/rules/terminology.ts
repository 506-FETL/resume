import { readCheckTarget } from '../targets'
import { findCheckTerms } from '../terms'
import type { CheckSnapshot, CheckTarget } from '../types'
import type { NewIssue } from './issue-types'

export function checkTerminology(
  snapshot: CheckSnapshot,
  fields: CheckTarget[],
  add: (issue: NewIssue) => void,
) {
  const termGroups = new Map<
    string,
    {
      from: string
      to: string
      kind: 'term' | 'spelling'
      style?: boolean
      targets: CheckTarget[]
    }
  >()

  fields.forEach((field) => {
    if (
      /\/(?:phone|email|birthMonth|(?:work|internship|project)?[Dd]uration\/\d+)$/.test(
        field.path,
      )
    )
      return

    findCheckTerms(
      field.quote,
      readCheckTarget(snapshot, field) ?? undefined,
    ).forEach((term) => {
      const key = `${term.kind}:${term.from}`
      const group = termGroups.get(key) ?? { ...term, targets: [] }

      group.targets.push({
        ...field,
        quote: term.from,
        occurrence: term.occurrence,
      })

      termGroups.set(key, group)
    })
  })

  termGroups.forEach((group, id) => {
    add({
      id,
      section: group.targets[0].section,
      kind: group.kind,
      severity: group.style ? 'warning' : 'error',
      title: group.style
        ? `请核对“${group.from}”的名称写法`
        : `“${group.from}”建议改为“${group.to}”`,
      detail: group.style
        ? `如果这里指产品或技术名称，常见写法为“${group.to}”；代码与命令可以保留原文。`
        : group.kind === 'term'
          ? '这处技术名称与常用正式拼写不一致。'
          : '这处常见词语有错字。',
      targets: group.targets,
      ...(group.style ? {} : { replacement: group.to }),
    })
  })
}
