import type { ResumeToolContext } from '../shared/types'
import { Copy, FileText, List, Search, ShieldAlert, ShieldCheck, Type } from 'lucide-react'
import { useMemo } from 'react'
import Markdown from 'react-markdown'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader, ToolStatCard } from '../shared/primitives'
import { buildAtsPreview } from './utils'

interface AtsPreviewToolProps {
  resumeContext: ResumeToolContext
}

function AtsPreviewTool({ resumeContext }: AtsPreviewToolProps) {
  const preview = useMemo(() => buildAtsPreview(resumeContext.resume), [resumeContext])
  const hasWarnings = preview.warnings.length > 0
  const RiskIcon = hasWarnings ? ShieldAlert : ShieldCheck

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('当前环境不支持复制到剪贴板')
      return
    }

    await navigator.clipboard.writeText(preview.plainText)
    toast.success('已复制')
  }

  return (
    <div className="space-y-4">
      <ToolPanelCard>
        <ToolPanelHeader
          title="ATS 纯文本预览"
          description="越接近这里的呈现，ATS 读到的信息通常越稳定。"
          icon={FileText}
          badge={(
            <ToolMetaBadge tone={hasWarnings ? 'warning' : 'success'}>
              {hasWarnings ? `${preview.warnings.length} 个风险提醒` : '结构稳定'}
            </ToolMetaBadge>
          )}
        />
        <ToolPanelBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ToolStatCard
            label="有效能力证据"
            value={preview.stats.evidenceCount}
            hint="跨经历类型汇总的真实内容证据"
            icon={FileText}
            tone="info"
            badge={<ToolMetaBadge tone="info">结构信息</ToolMetaBadge>}
          />
          <ToolStatCard
            label="文本行数"
            value={preview.stats.lineCount}
            hint="解析后的总行数"
            icon={List}
            tone="primary"
            badge={<ToolMetaBadge tone="primary">阅读长度</ToolMetaBadge>}
          />
          <ToolStatCard
            label="字符数"
            value={preview.stats.characterCount}
            hint="不含空白的文本长度"
            icon={Type}
            tone="default"
            badge={<ToolMetaBadge tone="default">文本体量</ToolMetaBadge>}
          />
          <ToolStatCard
            label="关键词数"
            value={preview.stats.keywordCount}
            hint="预览里可识别的词项数量"
            icon={Search}
            tone="success"
            badge={<ToolMetaBadge tone="success">检索线索</ToolMetaBadge>}
          />
        </ToolPanelBody>
      </ToolPanelCard>

      <div className="grid gap-4 lg:grid-cols-[0.96fr_1.44fr]">
        <ToolPanelCard>
          <ToolPanelHeader
            title="ATS 风险提醒"
            description="这些问题通常会直接影响 ATS 的抓取稳定性和招聘方的快速浏览。"
            icon={RiskIcon}
            badge={(
              <ToolMetaBadge tone={hasWarnings ? 'warning' : 'success'}>
                {hasWarnings ? `${preview.warnings.length} 项待关注` : '暂无明显风险'}
              </ToolMetaBadge>
            )}
          />
          <ToolPanelBody>
            <div className="space-y-3">
              {hasWarnings
                ? preview.warnings.map(warning => (
                    <div key={warning} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))
                : (
                    <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm leading-6 text-green-700 dark:text-green-300">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                      <span>当前没有检测到明显的 ATS 结构风险。</span>
                    </div>
                  )}
            </div>
          </ToolPanelBody>
        </ToolPanelCard>

        <ToolPanelCard>
          <ToolPanelHeader
            title="纯文本预览"
            description="ATS 更接近会读取到的文本结果。"
            icon={FileText}
            badge={<ToolMetaBadge tone="primary">ATS 解析视角</ToolMetaBadge>}
          />
          <ToolPanelBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ToolMetaBadge tone="info">{`${preview.stats.evidenceCount} 条有效证据`}</ToolMetaBadge>
              <ToolMetaBadge tone="success">{`${preview.stats.keywordCount} 个关键词`}</ToolMetaBadge>
              <ToolMetaBadge tone="default">{`${preview.stats.lineCount} 行文本`}</ToolMetaBadge>
              <Button size="xs" onClick={handleCopy}>
                <Copy />
                复制纯文本
              </Button>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-border/60 bg-muted/20 p-4 text-[13px] leading-6 text-foreground [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-background/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_h1]:mb-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:mb-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-background/80 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
              <Markdown>{preview.plainText || '暂无可预览内容'}</Markdown>
            </div>
          </ToolPanelBody>
        </ToolPanelCard>
      </div>
    </div>
  )
}

export default AtsPreviewTool
