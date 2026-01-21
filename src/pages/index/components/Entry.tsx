import type { ReactNode } from 'react'
import type { Resume } from '../type'
import { ArrowRight, BarChart3, Clock, Cloud, CloudOff, FileUser, Plus, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import useCurrentResumeStore from '@/store/resume/current'
import { diffDates, formatRelativeTime } from '@/utils/date'
import { TYPE_LABELS } from '../const'
import { EntrySkeleton } from './Skeleton'

interface Props {
  isOnline: boolean
  resumes: Resume[]
  loading?: boolean
}

function Entry({ isOnline, resumes, loading }: Props) {
  const navigate = useNavigate()
  const { setCurrentResume } = useCurrentResumeStore()

  if (loading) {
    return <EntrySkeleton />
  }

  // 获取最近更新的3个简历
  const recentResumes = [...resumes]
    .sort((a, b) => diffDates(b.created_at, a.created_at))
    .slice(0, 3)

  return (
    <div className="grid gap-4 grid-cols-1 md:gap-5 md:grid-cols-2">
      {/* 快捷操作 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/8">
              <Sparkles className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">快捷操作</CardTitle>
          </div>
          <CardDescription className="text-xs">常用功能入口</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="grid gap-2.5 grid-cols-2 h-full">
            <QuickAction
              title="创建简历"
              description="使用模板快速创建"
              icon={<Plus className="size-4" />}
              onClick={() => navigate('/resume')}
              iconBg="bg-primary/10 text-primary"
              highlight
            />
            <QuickAction
              title="我的简历"
              description="管理所有简历"
              icon={<FileUser className="size-4" />}
              onClick={() => navigate('/resume')}
              iconBg="bg-blue-500/10 text-blue-500"
            />
            <QuickAction
              title="简历模板"
              description="浏览可用模板"
              icon={<BarChart3 className="size-4" />}
              onClick={() => navigate('/template')}
              iconBg="bg-violet-500/10 text-violet-500"
            />
            <QuickAction
              title={isOnline ? '已登录' : '登录账号'}
              description={isOnline ? '同步已启用' : '登录后同步云端'}
              icon={<Cloud className="size-4" />}
              onClick={() => !isOnline && navigate('/login')}
              disabled={isOnline}
              iconBg="bg-amber-500/10 text-amber-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* 最近动态 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/8">
              <Clock className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">最近动态</CardTitle>
          </div>
          <CardDescription className="text-xs">最近编辑的简历</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          {recentResumes.length > 0
            ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {recentResumes.map(resume => (
                      <RecentActivity
                        key={resume.resume_id}
                        title={resume.display_name || '未命名简历'}
                        description={TYPE_LABELS[resume.type]}
                        time={formatRelativeTime(resume.updated_at || resume.created_at)}
                        isOffline={resume.isOffline}
                        onClick={() => {
                          setCurrentResume(resume.resume_id, resume.type)
                          navigate('/resume/editor')
                        }}
                      />
                    ))}
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      共
                      <span className="font-medium text-foreground mx-1">{resumes.length}</span>
                      份简历
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => navigate('/resume')}
                    >
                      查看全部
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col items-center justify-center h-[180px] text-center">
                  <div className="p-3 rounded-full bg-muted/50 mb-3">
                    <FileUser className="size-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">还没有创建任何简历</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    立即开始创建您的第一份专业简历
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => navigate('/resume')}
                  >
                    创建第一份简历
                  </Button>
                </div>
              )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Entry

function QuickAction({
  title,
  description,
  icon,
  onClick,
  disabled,
  highlight,
  iconBg = 'bg-primary/10 text-primary',
}: {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
  iconBg?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start gap-2.5 rounded-lg border p-3 text-left transition-all duration-200',
        'hover:bg-accent/50 hover:border-border/80',
        highlight && 'bg-primary/3 border-primary/20 hover:border-primary/30 hover:bg-primary/6',
        disabled && 'cursor-default opacity-50 hover:bg-transparent hover:border-border',
      )}
    >
      <div className={cn('flex size-8 items-center justify-center rounded-md transition-colors', iconBg)}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{description}</p>
      </div>
    </button>
  )
}

function RecentActivity({
  title,
  description,
  time,
  isOffline,
  onClick,
}: {
  title: string
  description: string
  time: string
  isOffline?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors duration-150 cursor-pointer -mx-2"
    >
      <div className={cn(
        'relative flex size-9 items-center justify-center rounded-lg transition-colors duration-150 shrink-0',
        isOffline
          ? 'bg-amber-500/10 group-hover:bg-amber-500/15'
          : 'bg-blue-500/10 group-hover:bg-blue-500/15',
      )}
      >
        <FileUser className={cn(
          'size-4',
          isOffline ? 'text-amber-500' : 'text-blue-500',
        )}
        />
        {/* 状态指示器 */}
        <div className={cn(
          'absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center',
          isOffline ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-blue-100 dark:bg-blue-900/50',
        )}
        >
          {isOffline
            ? <CloudOff className="size-2 text-amber-600 dark:text-amber-400" />
            : <Cloud className="size-2 text-blue-600 dark:text-blue-400" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors duration-150">{title}</p>
          <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">{time}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isOffline
            ? (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  本地
                </span>
              )
            : (
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  云端
                </span>
              )}
          <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        </div>
      </div>
    </div>
  )
}
