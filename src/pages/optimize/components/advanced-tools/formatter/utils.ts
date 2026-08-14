import type { BatchOptimizationItem, BatchOptimizationResult } from './types'
import type { ResumeSchema } from '@/lib/schema'
import type { Finding, FindingsGroup, Suggestion } from '@/pages/optimize/types'
import { toPath } from 'lodash'
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

      pendingSuggestions.forEach(({ id, suggestion }) => {
        const nextAfterKey = JSON.stringify(suggestion.after)
        const existingAfterKey = appliedAfterByPath.get(suggestion.locate.path)

        pendingSuggestionCount += 1

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

      if (conflictedInFinding === 0) {
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
        severity,
        steps: finding.fix.steps,
        title: finding.title,
      })
    })
  })

  const summary = !findings
    ? ['当前简历还没有问题分析结果，一键优化需要先复用“简历问题分析”中的结构化修复建议。']
    : totalIssueCount === 0
      ? ['当前分析结果没有检测到需要处理的问题。']
      : pendingIssueCount === 0
        ? ['当前问题分析中的自动修复建议都已处理完成，无需再次一键应用。']
        : [
            `当前共有 ${pendingIssueCount} 个待处理问题，包含 ${pendingSuggestionCount} 条未执行建议。`,
            `本次可直接一键应用 ${autoApplicableSuggestionCount} 条建议，预计完成 ${autoApplicableIssueCount} 个问题。`,
            conflictedSuggestionCount > 0
              ? `另有 ${conflictedSuggestionCount} 条建议与更高优先级问题修改同一字段，已保留为待处理。`
              : '所有待处理建议都可以直接批量应用。',
            fixedIssueCount > 0 ? `另外已有 ${fixedIssueCount} 个问题在此前完成修复。` : '',
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
