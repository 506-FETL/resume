import type { JobDescriptionComparisonResult } from './types'
import { BadgeCheck, CircleAlert, Search, Sparkles, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader, ToolStatCard } from '../shared/primitives'
import { getSectionScoreClassName } from '../shared/suggestions'

interface JobDescriptionComparisonResultViewProps {
  result: JobDescriptionComparisonResult
}

function getScoreTone(score: number) {
  if (score >= 80) {
    return 'success'
  }

  if (score >= 60) {
    return 'primary'
  }

  if (score >= 40) {
    return 'warning'
  }

  return 'danger'
}

export default function ComparisonResultView({
  result,
}: JobDescriptionComparisonResultViewProps) {
  const scoreTone = getScoreTone(result.matchScore)

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ToolStatCard
          label="岗位匹配度"
          value={`${result.matchScore}%`}
          hint="当前简历与 JD 关键词的整体承接程度"
          icon={Target}
          tone={scoreTone}
          badge={<ToolMetaBadge tone={scoreTone}>整体评分</ToolMetaBadge>}
        />
        <ToolStatCard
          label="JD 关键词"
          value={result.extractedKeywords.length}
          hint="从职位描述中识别出的关键词总数"
          icon={Search}
          tone="info"
          badge={<ToolMetaBadge tone="info">已解析需求</ToolMetaBadge>}
        />
        <ToolStatCard
          label="已覆盖"
          value={result.matchedKeywords.length}
          hint="已在简历中承接到的关键词数量"
          icon={BadgeCheck}
          tone="success"
          badge={<ToolMetaBadge tone="success">匹配项</ToolMetaBadge>}
        />
        <ToolStatCard
          label="待补关键词"
          value={result.missingKeywords.length}
          hint="建议优先补到技能或经历描述里的缺口"
          icon={CircleAlert}
          tone={result.missingKeywords.length > 0 ? 'warning' : 'success'}
          badge={(
            <ToolMetaBadge tone={result.missingKeywords.length > 0 ? 'warning' : 'success'}>
              {result.missingKeywords.length > 0 ? '优先补强' : '覆盖完整'}
            </ToolMetaBadge>
          )}
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <ToolPanelCard>
          <ToolPanelHeader
            title="匹配概览"
            description="这个分数只衡量关键词承接情况，不代表内容质量已经足够。"
            icon={Target}
            badge={<ToolMetaBadge tone={scoreTone}>{`匹配率 ${result.matchScore}%`}</ToolMetaBadge>}
          />
          <ToolPanelBody className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">匹配进度</p>
                <Badge className={cn('border', getSectionScoreClassName(result.matchScore))}>
                  {result.matchScore}
                  %
                </Badge>
              </div>
              <Progress value={result.matchScore} className="h-2 bg-muted" />
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolMetaBadge tone="success">{`已覆盖 ${result.matchedKeywords.length}`}</ToolMetaBadge>
              <ToolMetaBadge tone="warning">{`待补 ${result.missingKeywords.length}`}</ToolMetaBadge>
              <ToolMetaBadge tone="primary">{`建议 ${Math.max(result.recommendations.length, 1)}`}</ToolMetaBadge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>
          </ToolPanelBody>
        </ToolPanelCard>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <ToolPanelCard>
            <ToolPanelHeader
              title="已覆盖关键词"
              icon={BadgeCheck}
              badge={<ToolMetaBadge tone="success">{`${result.matchedKeywords.length} 个命中`}</ToolMetaBadge>}
            />
            <ToolPanelBody>
              <div className="flex flex-wrap gap-2">
                {result.matchedKeywords.length > 0
                  ? result.matchedKeywords.map(keyword => (
                      <Badge key={keyword} className="border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300">
                        {keyword}
                      </Badge>
                    ))
                  : <span className="text-sm text-muted-foreground">还没有命中明显关键词</span>}
              </div>
            </ToolPanelBody>
          </ToolPanelCard>

          <ToolPanelCard>
            <ToolPanelHeader
              title="待补关键词"
              icon={CircleAlert}
              badge={<ToolMetaBadge tone={result.missingKeywords.length > 0 ? 'warning' : 'success'}>{`${result.missingKeywords.length} 个缺口`}</ToolMetaBadge>}
            />
            <ToolPanelBody>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.length > 0
                  ? result.missingKeywords.map(keyword => (
                      <Badge key={keyword} className="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        {keyword}
                      </Badge>
                    ))
                  : <span className="text-sm text-muted-foreground">当前关键词覆盖已经比较完整</span>}
              </div>
            </ToolPanelBody>
          </ToolPanelCard>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <ToolPanelCard>
          <ToolPanelHeader
            title="匹配亮点"
            icon={BadgeCheck}
            badge={<ToolMetaBadge tone="success">{`${result.strengths.length} 条亮点`}</ToolMetaBadge>}
          />
          <ToolPanelBody className="space-y-3">
            {result.strengths.map(item => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-green-500/15 bg-green-500/5 p-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-700 dark:text-green-300">
                  <BadgeCheck className="size-4" />
                </div>
                <p className="text-sm leading-6 text-foreground/90">{item}</p>
              </div>
            ))}
          </ToolPanelBody>
        </ToolPanelCard>

        <ToolPanelCard>
          <ToolPanelHeader
            title="重点风险"
            icon={CircleAlert}
            badge={<ToolMetaBadge tone={result.risks.length > 0 ? 'warning' : 'success'}>{`${result.risks.length} 条风险`}</ToolMetaBadge>}
          />
          <ToolPanelBody className="space-y-3">
            {result.risks.map(item => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <CircleAlert className="size-4" />
                </div>
                <p className="text-sm leading-6 text-foreground/90">{item}</p>
              </div>
            ))}
          </ToolPanelBody>
        </ToolPanelCard>
      </div>

      <Tabs defaultValue="sections" className="gap-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="sections">按板块查看</TabsTrigger>
          <TabsTrigger value="advice">优化建议</TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {result.sectionMatches.map(section => (
            <ToolPanelCard key={section.sectionKey}>
              <ToolPanelBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{section.sectionLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      命中
                      {' '}
                      {section.matchedCount}
                      {' '}
                      个关键词
                    </p>
                  </div>
                  <ToolMetaBadge tone={getScoreTone(section.coverage)}>
                    {section.coverage}
                    %
                  </ToolMetaBadge>
                </div>
                <Progress value={section.coverage} className="mt-4 h-2 bg-muted" />
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{section.analysis}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {section.matchedKeywords.length > 0
                    ? section.matchedKeywords.map(keyword => (
                        <Badge key={`${section.sectionKey}-${keyword}`} variant="secondary">
                          {keyword}
                        </Badge>
                      ))
                    : <span className="text-sm text-muted-foreground">这个板块还没有承接到 JD 关键词</span>}
                </div>
              </ToolPanelBody>
            </ToolPanelCard>
          ))}
        </TabsContent>

        <TabsContent value="advice" className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(result.recommendations.length > 0
            ? result.recommendations
            : ['当前 JD 命中情况已经比较完整，下一步更值得打磨的是量化结果和经历排序。']).map(item => (
            <ToolPanelCard key={item} className="border-primary/15 bg-primary/5">
              <ToolPanelBody>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <p className="text-sm leading-6 text-foreground/90">{item}</p>
                </div>
              </ToolPanelBody>
            </ToolPanelCard>
          ))}
        </TabsContent>
      </Tabs>
    </>
  )
}
