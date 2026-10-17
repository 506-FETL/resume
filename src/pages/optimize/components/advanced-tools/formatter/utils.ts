import type { BatchOptimizationItem, BatchOptimizationResult } from './types'
import type { ResumeSchema } from '@/lib/schema'
import type { Finding, FindingsGroup, Suggestion } from '@/pages/optimize/types'
import { toPath } from 'lodash'
import { isSuggestionReadyToApply } from '@/lib/ats'
import { ensureResumeEntryIds } from '@/lib/schema/resume/entry-id'
import { setLeaf } from '@/pages/optimize/utils'
import { SEVERITY_ORDER } from './const'

function buildLocationText(finding: Finding) {
  const locate = finding.why.evidence[0]?.locate ?? finding.locate

  return [locate?.sectionLabel, locate?.itemLabel, locate?.fieldLabel]
    .filter(Boolean)
    .join(' / ') || '未定位到具体位置'
}

function getPendingSuggestionEntries(finding: Finding) {
  return (finding.fix.suggestions ?? [])
    .map((suggestion, index) => ({
      id: `${finding.id}:${index}`,
      suggestion,
    }))
    .filter(({ suggestion }) => !suggestion.fixed && suggestion.locate.path)
}

export function buildBatchOptimizationResult(findings: FindingsGroup | null | undefined): BatchOptimizationResult {
  const items: BatchOptimizationItem[] = []
  const suggestionsToApply: Suggestion[] = []
  const appliedSuggestionIds: string[] = []
  const appliedAfterByPath = new Map<string, string>()

  let totalIssueCount = 0
  let pendingIssueCount = 0
  let fixedIssueCount = 0
  let pendingSuggestionCount = 0
  let autoApplicableSuggestionCount = 0
  let conflictedSuggestionCount = 0
  let requiresInputSuggestionCount = 0
  let autoApplicableIssueCount = 0

  SEVERITY_ORDER.forEach((severity) => {
    const findingsInSeverity = findings?.[severity] ?? []

    findingsInSeverity.forEach((finding) => {
      totalIssueCount += 1

      const suggestions = finding.fix.suggestions ?? []
      const pendingSuggestions = getPendingSuggestionEntries(finding)

      if (pendingSuggestions.length === 0) {
        if (suggestions.length > 0 && suggestions.every(suggestion => suggestion.fixed)) {
          fixedIssueCount += 1
        }
        return
      }

      pendingIssueCount += 1

      let autoApplicableInFinding = 0
      let conflictedInFinding = 0
      let requiresInputInFinding = 0

      pendingSuggestions.forEach(({ id, suggestion }) => {
        const nextAfterKey = JSON.stringify(suggestion.after)
        const existingAfterKey = appliedAfterByPath.get(suggestion.locate.path)

        pendingSuggestionCount += 1

        if (!isSuggestionReadyToApply(suggestion)) {
          requiresInputSuggestionCount += 1
          requiresInputInFinding += 1
          return
        }

        if (!existingAfterKey) {
          suggestionsToApply.push(suggestion)
          appliedSuggestionIds.push(id)
          appliedAfterByPath.set(suggestion.locate.path, nextAfterKey)
          autoApplicableSuggestionCount += 1
          autoApplicableInFinding += 1
          return
        }

        if (existingAfterKey === nextAfterKey) {
          appliedSuggestionIds.push(id)
          autoApplicableSuggestionCount += 1
          autoApplicableInFinding += 1
          return
        }

        conflictedSuggestionCount += 1
        conflictedInFinding += 1
      })

      if (conflictedInFinding === 0 && requiresInputInFinding === 0) {
        autoApplicableIssueCount += 1
      }

      items.push({
        autoApplicableSuggestionCount: autoApplicableInFinding,
        conflictedSuggestionCount: conflictedInFinding,
        findingId: finding.id,
        fixSummary: finding.fix.summary,
        locationText: buildLocationText(finding),
        pendingSuggestionCount: pendingSuggestions.length,
        pendingSuggestions: pendingSuggestions.map(item => item.suggestion),
        requiresInputSuggestionCount: requiresInputInFinding,
        severity,
        steps: finding.fix.steps,
        title: finding.title,
      })
    })
  })

  const summary = !findings
    ? ['请先运行简历检测。']
    : totalIssueCount === 0
      ? ['未发现待处理问题。']
      : pendingIssueCount === 0
        ? ['自动修复建议已全部处理。']
        : [
            `${pendingIssueCount} 个问题待处理，共 ${pendingSuggestionCount} 条建议。`,
            `本次可应用 ${autoApplicableSuggestionCount} 条建议，预计解决 ${autoApplicableIssueCount} 个问题。`,
            requiresInputSuggestionCount > 0
              ? `${requiresInputSuggestionCount} 条建议需补充真实信息。`
              : '',
            conflictedSuggestionCount > 0
              ? `${conflictedSuggestionCount} 条建议与高优先级建议修改了同一字段，暂不应用。`
              : requiresInputSuggestionCount > 0
                ? '补充信息后可继续批量应用。'
                : '待处理建议均可批量应用。',
            fixedIssueCount > 0 ? `此前已修复 ${fixedIssueCount} 个问题。` : '',
          ].filter(Boolean)

  return {
    appliedSuggestionIds,
    autoApplicableIssueCount,
    autoApplicableSuggestionCount,
    conflictedSuggestionCount,
    fixedIssueCount,
    items,
    pendingIssueCount,
    pendingSuggestionCount,
    requiresInputSuggestionCount,
    suggestionsToApply,
    summary,
    totalIssueCount,
  }
}

export function markAppliedSuggestionsAsFixed(findings: FindingsGroup, appliedSuggestionIds: string[]): FindingsGroup {
  const appliedSet = new Set(appliedSuggestionIds)

  return {
    high: findings.high.map(finding => ({
      ...finding,
      fix: {
        ...finding.fix,
        suggestions: (finding.fix.suggestions ?? []).map((suggestion, index) => (
          appliedSet.has(`${finding.id}:${index}`)
            ? { ...suggestion, fixed: true }
            : suggestion
        )),
      },
    })),
    medium: findings.medium.map(finding => ({
      ...finding,
      fix: {
        ...finding.fix,
        suggestions: (finding.fix.suggestions ?? []).map((suggestion, index) => (
          appliedSet.has(`${finding.id}:${index}`)
            ? { ...suggestion, fixed: true }
            : suggestion
        )),
      },
    })),
    low: findings.low.map(finding => ({
      ...finding,
      fix: {
        ...finding.fix,
        suggestions: (finding.fix.suggestions ?? []).map((suggestion, index) => (
          appliedSet.has(`${finding.id}:${index}`)
            ? { ...suggestion, fixed: true }
            : suggestion
        )),
      },
    })),
  }
}

export function updateFindingPendingSuggestions(
  findings: FindingsGroup,
  findingId: string,
  nextPendingSuggestions: Suggestion[],
) {
  return {
    high: findings.high.map((finding) => {
      if (finding.id !== findingId) {
        return finding
      }

      let pendingIndex = 0

      return {
        ...finding,
        fix: {
          ...finding.fix,
          suggestions: (finding.fix.suggestions ?? []).map((suggestion) => {
            if (suggestion.fixed || !suggestion.locate.path) {
              return suggestion
            }

            const nextSuggestion = nextPendingSuggestions[pendingIndex]
            pendingIndex += 1
            return nextSuggestion ?? suggestion
          }),
        },
      }
    }),
    medium: findings.medium.map((finding) => {
      if (finding.id !== findingId) {
        return finding
      }

      let pendingIndex = 0

      return {
        ...finding,
        fix: {
          ...finding.fix,
          suggestions: (finding.fix.suggestions ?? []).map((suggestion) => {
            if (suggestion.fixed || !suggestion.locate.path) {
              return suggestion
            }

            const nextSuggestion = nextPendingSuggestions[pendingIndex]
            pendingIndex += 1
            return nextSuggestion ?? suggestion
          }),
        },
      }
    }),
    low: findings.low.map((finding) => {
      if (finding.id !== findingId) {
        return finding
      }

      let pendingIndex = 0

      return {
        ...finding,
        fix: {
          ...finding.fix,
          suggestions: (finding.fix.suggestions ?? []).map((suggestion) => {
            if (suggestion.fixed || !suggestion.locate.path) {
              return suggestion
            }

            const nextSuggestion = nextPendingSuggestions[pendingIndex]
            pendingIndex += 1
            return nextSuggestion ?? suggestion
          }),
        },
      }
    }),
  }
}

export function applySuggestionsToResume(resume: ResumeSchema, suggestions: Suggestion[]) {
  const nextResume = JSON.parse(JSON.stringify(resume)) as ResumeSchema

  suggestions.forEach((suggestion) => {
    if (!suggestion.locate.path) {
      return
    }

    setLeaf(nextResume, toPath(suggestion.locate.path), suggestion.after)
  })

  return ensureResumeEntryIds(nextResume)
}
