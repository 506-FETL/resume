import type { Finding, FindingsGroup } from '../src/lib/schema/ats.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stdout } from 'node:process'
import { countPendingAtsFindings, isAtsFindingPending } from '../src/lib/ats/status.ts'

function finding(id: string, fixedStates: boolean[]): Finding {
  return {
    id,
    type: 'verification',
    title: id,
    locate: {
      path: 'basics.name',
      sectionLabel: '基本信息',
      fieldLabel: '姓名',
      itemLabel: null,
    },
    why: {
      summary: '验证首页 ATS 待办统计',
      evidence: [],
    },
    fix: {
      summary: '验证首页 ATS 待办统计',
      steps: [],
      suggestions: fixedStates.map(fixed => ({
        kind: 'replace_text' as const,
        valueType: 'string' as const,
        locate: {
          path: 'basics.name',
          sectionLabel: '基本信息',
          fieldLabel: '姓名',
          itemLabel: null,
        },
        before: '旧值',
        after: '新值',
        reason: '验证',
        fixed,
      })),
    },
  }
}

function findings(high: Finding[] = [], medium: Finding[] = [], low: Finding[] = []): FindingsGroup {
  return { high, medium, low }
}

assert.equal(isAtsFindingPending(finding('all-fixed', [true, true])), false)
assert.equal(isAtsFindingPending(finding('partly-fixed', [true, false])), true)
assert.equal(isAtsFindingPending(finding('missing-suggestion', [])), true)

assert.equal(countPendingAtsFindings(undefined), 0)
assert.equal(countPendingAtsFindings(findings()), 0)
assert.equal(countPendingAtsFindings(findings([
  finding('done', [true]),
  finding('pending', [false]),
], [finding('incomplete', [])], [finding('also-done', [true, true])])), 2)
assert.equal(countPendingAtsFindings(findings([
  finding('done-1', [true]),
  finding('done-2', [true, true]),
])), 0)

const dashboardSource = readFileSync(new URL('../src/pages/index/insights.ts', import.meta.url), 'utf8')
const atsRepositorySource = readFileSync(new URL('../src/lib/supabase/resume/ats.ts', import.meta.url), 'utf8')

assert.match(dashboardSource, /countPendingAtsFindings\(summary\.findings\)/)
assert.doesNotMatch(dashboardSource, /summary\.todo_items\?\.length/)
assert.match(atsRepositorySource, /\.select\('[^']*findings[^']*'\)/)

stdout.write('Dashboard ATS pending verification passed.\n')
