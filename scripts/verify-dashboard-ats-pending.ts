import type { Finding, FindingsGroup } from '../src/lib/schema/ats.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stdout } from 'node:process'
import { countPendingAtsFindings, isAtsFindingPending } from '../src/lib/ats/status.ts'

function finding(
  id: string,
  fixedStates: boolean[],
  evidenceMode: 'matching' | 'mismatched' | 'none' = 'none',
): Finding {
  const locate = {
    path: 'basics.name',
    sectionLabel: '基本信息',
    fieldLabel: '姓名',
    itemLabel: null,
  }

  return {
    id,
    type: 'verification',
    title: id,
    locate,
    why: {
      summary: '验证首页 ATS 待办统计',
      evidence: evidenceMode === 'none'
        ? []
        : [{
            text: '旧值',
            rawValue: '旧值',
            locate: evidenceMode === 'matching'
              ? locate
              : { ...locate, path: 'basics.email', fieldLabel: '邮箱' },
          }],
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
  finding('empty-without-matching-evidence', [], 'mismatched'),
])), 0)
assert.equal(countPendingAtsFindings(findings([
  finding('empty-with-matching-evidence', [], 'matching'),
])), 1)
assert.equal(countPendingAtsFindings(findings([
  finding('done', [true]),
  finding('pending', [false]),
], [finding('incomplete', [], 'matching')], [finding('also-done', [true, true])])), 2)
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
