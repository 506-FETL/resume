import type { ResumeToolContext } from '../shared/types'
import type { FindingsGroup, Suggestion } from '@/pages/optimize/types'
import { CircleAlert, FileText, ListChecks, Sparkles, TriangleAlert, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { syncAutomergeDocument } from '@/lib/automerge'
import { updateOfflineResume } from '@/lib/offline-resume-manager'
import { updateAtsConfig } from '@/lib/supabase/resume'
import useAtsStore from '@/pages/optimize/store'
import { startConfetti } from '@/utils'
import { formatToolError } from '../shared/config'
import { ToolEmptyState, ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader, ToolStatCard } from '../shared/primitives'
import FormatterFindingCard from './finding-card'
import { applySuggestionsToResume, buildBatchOptimizationResult, markAppliedSuggestionsAsFixed, updateFindingPendingSuggestions } from './utils'

interface FormatterToolProps {
  onResumeUpdated: (nextContext: ResumeToolContext) => void
  resumeContext: ResumeToolContext
}

function FormatterTool({ onResumeUpdated, resumeContext }: FormatterToolProps) {
  const [applying, setApplying] = useState(false)
  const [editableFindings, setEditableFindings] = useState<FindingsGroup | null>(null)
  const actionButtonRef = useRef<HTMLButtonElement | null>(null)
  const { currentAtsConfig, update } = useAtsStore()

  const activeAtsConfig = useMemo(() => {
    if (currentAtsConfig?.resume_id === resumeContext.resumeId) {
      return currentAtsConfig
    }

    return resumeContext.atsConfig
  }, [currentAtsConfig, resumeContext.atsConfig, resumeContext.resumeId])

  useEffect(() => {
    setEditableFindings(activeAtsConfig?.findings ?? null)
  }, [activeAtsConfig?.findings])

  const effectiveFindings = editableFindings ?? activeAtsConfig?.findings ?? null

  const batchResult = useMemo(
    () => buildBatchOptimizationResult(effectiveFindings),
    [effectiveFindings],
  )

  const handleSuggestionsChange = (findingId: string, suggestions: Suggestion[]) => {
    if (!effectiveFindings) {
      return
    }

    setEditableFindings(updateFindingPendingSuggestions(effectiveFindings, findingId, suggestions))
  }

  const handleApply = async () => {
    if (!activeAtsConfig) {
      toast.error('请先完成当前简历的问题分析')
      return
    }

    if (batchResult.pendingIssueCount === 0) {
      toast.success('当前没有待处理的自动修复建议')
      return
    }

    if (batchResult.autoApplicableSuggestionCount === 0) {
      toast.info('剩余问题存在同字段冲突，请回到问题分析逐条确认')
      return
    }

    const findingsToApply = editableFindings ?? activeAtsConfig.findings
    const nextFindings = markAppliedSuggestionsAsFixed(findingsToApply, batchResult.appliedSuggestionIds)
    const updatedResume = applySuggestionsToResume(resumeContext.resume, batchResult.suggestionsToApply)

    setApplying(true)

    try {
      await updateAtsConfig(activeAtsConfig.id, {
        findings: nextFindings,
      })

      if (resumeContext.resumeType === 'online') {
        await syncAutomergeDocument(
          resumeContext.resumeId,
          batchResult.suggestionsToApply,
          { syncToResumeConfig: true },
        )
      }
      else {
        await updateOfflineResume(resumeContext.resumeId, updatedResume)
      }

      const nextAtsConfig = { ...activeAtsConfig, findings: nextFindings }

      update('findings', nextFindings)
      setEditableFindings(nextFindings)
      onResumeUpdated({ ...resumeContext, atsConfig: nextAtsConfig, resume: updatedResume })
      startConfetti(actionButtonRef)

      toast.success(
        batchResult.conflictedSuggestionCount > 0
          ? `已应用 ${batchResult.autoApplicableSuggestionCount} 条优化，剩余冲突建议请逐条确认`
          : '已完成当前简历的一键优化',
      )
    }
    catch (error) {
      toast.error(formatToolError(error))
    }
    finally {
      setApplying(false)
    }
  }

  const actionLabel = applying
    ? '应用中...'
    : batchResult.autoApplicableSuggestionCount > 0
      ? `一键应用 ${batchResult.autoApplicableSuggestionCount} 条建议`
      : batchResult.pendingIssueCount > 0
        ? '存在冲突，需逐项确认'
        : '已全部处理'

  return (
    <div className="space-y-4">
      <ToolPanelCard>
        <ToolPanelHeader
          action={(
            <Button
              ref={actionButtonRef}
              className="w-full sm:w-auto"
              onClick={handleApply}
              disabled={applying || !activeAtsConfig || batchResult.autoApplicableSuggestionCount === 0}
            >
              <Wand2 className="size-4" />
              {actionLabel}
            </Button>
          )}
          title="一键优化"
          description="直接复用“简历问题分析”里的修复建议，一次性把当前可自动执行的改动写回简历。"
          icon={Wand2}
          badge={(
            <ToolMetaBadge tone={batchResult.pendingIssueCount > 0 ? 'warning' : 'success'}>
              {batchResult.pendingIssueCount > 0 ? `${batchResult.pendingIssueCount} 个待处理问题` : '自动修复已完成'}
            </ToolMetaBadge>
          )}
        />
        <ToolPanelBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ToolStatCard
            label="待处理问题"
            value={batchResult.pendingIssueCount}
            hint="分析结果里仍未完成的问题数量"
            icon={CircleAlert}
            tone={batchResult.pendingIssueCount > 0 ? 'warning' : 'success'}
            badge={<ToolMetaBadge tone={batchResult.pendingIssueCount > 0 ? 'warning' : 'success'}>问题总览</ToolMetaBadge>}
          />
          <ToolStatCard
            label="待执行建议"
            value={batchResult.pendingSuggestionCount}
            hint="所有未执行的结构化修复建议"
            icon={ListChecks}
            tone="info"
            badge={<ToolMetaBadge tone="info">建议池</ToolMetaBadge>}
          />
          <ToolStatCard
            label="可一键完成"
            value={batchResult.autoApplicableIssueCount}
            hint="本次预计直接完成的问题数量"
            icon={Sparkles}
            tone="success"
            badge={<ToolMetaBadge tone="success">自动应用</ToolMetaBadge>}
          />
          <ToolStatCard
            label="冲突保留"
            value={batchResult.conflictedSuggestionCount}
            hint="同字段冲突时保留更高优先级建议"
            icon={TriangleAlert}
            tone={batchResult.conflictedSuggestionCount > 0 ? 'danger' : 'default'}
            badge={<ToolMetaBadge tone={batchResult.conflictedSuggestionCount > 0 ? 'danger' : 'default'}>{batchResult.conflictedSuggestionCount > 0 ? '需人工确认' : '无冲突'}</ToolMetaBadge>}
          />
        </ToolPanelBody>
      </ToolPanelCard>

      <ToolPanelCard>
        <ToolPanelHeader
          title="执行摘要"
          description="先处理高优先级且无字段冲突的问题，剩余冲突项保留给你逐条确认。"
          icon={FileText}
          badge={<ToolMetaBadge tone="primary">{`${batchResult.summary.length} 条说明`}</ToolMetaBadge>}
        />
        <ToolPanelBody>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batchResult.summary.map(line => (
              <div key={line} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-3.5" />
                </div>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </ToolPanelBody>
      </ToolPanelCard>

      {!activeAtsConfig
        ? (
            <ToolEmptyState
              title="当前简历还没有问题分析结果"
              description="先在页面顶部运行一次检测；一键优化会直接复用“简历问题分析”里的结构化修复建议。"
            />
          )
        : batchResult.pendingIssueCount === 0
          ? (
              <ToolEmptyState
                title="当前自动修复建议已全部完成"
                description="这份简历在分析结果中的可自动修复项已经处理完毕，无需再次一键应用。"
              />
            )
          : (
              <ToolPanelCard>
                <ToolPanelHeader
                  title="待执行问题"
                  description="下面这些问题来自当前页面的简历问题分析。一键应用会优先执行更高严重度的建议；如果多个问题修改同一字段，会保留更高优先级版本。"
                  icon={ListChecks}
                  badge={<ToolMetaBadge tone="warning">{`${batchResult.pendingIssueCount} 个问题待处理`}</ToolMetaBadge>}
                />
                <ToolPanelBody className="space-y-3">
                  {batchResult.items.map(item => (
                    <FormatterFindingCard
                      key={item.findingId}
                      item={item}
                      onSuggestionsChange={handleSuggestionsChange}
                    />
                  ))}
                </ToolPanelBody>
              </ToolPanelCard>
            )}
    </div>
  )
}

export default FormatterTool
