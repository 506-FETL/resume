import type { ReactNode } from 'react'
import type { ResumeCommentThread } from '../types.ts'
import type { CommentUiPermissions } from './types.ts'
import { ArrowLeft, Link2, MoreHorizontal, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useResumeCommentClient, useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { CommentComposer } from './comment-composer.tsx'
import { CommentTree } from './comment-tree.tsx'
import { isCurrentCommentAuthor } from './types.ts'

const COMMENT_SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '申请信息',
  edu_background: '教育经历',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

const COMMENT_FIELD_LABELS: Record<string, string> = {
  age: '年龄',
  applicationMajor: '申请专业',
  applicationSchool: '申请院校',
  companyName: '公司名称',
  content: '内容',
  dateEntry: '到岗时间',
  description: '描述',
  duration: '时间',
  email: '邮箱',
  expectedSalary: '期望薪资',
  experienceName: '经历名称',
  gender: '性别',
  height: '身高',
  intentionalCity: '意向城市',
  jobIntent: '意向职位',
  name: '名称',
  nation: '民族',
  nativePlace: '籍贯',
  participantRole: '项目角色',
  phone: '手机号',
  position: '职位',
  professionalDegree: '专业与学历',
  projectName: '项目名称',
  role: '角色',
  schoolName: '学校名称',
  skill: '技能',
  subtitle: '补充信息',
  weight: '体重',
  workYears: '工作年限',
}

function formatCommentField(nodeKey: string) {
  const [sectionKey = '',, fieldKey = ''] = nodeKey.split('/')
  const section = COMMENT_SECTION_LABELS[sectionKey] ?? sectionKey
  const field = COMMENT_FIELD_LABELS[fieldKey] ?? fieldKey
  return [section, field].filter(Boolean).join(' · ')
}

export function ThreadDetail({
  thread,
  permissions,
  onBack,
  onBeginRelink,
  footer,
}: {
  thread: ResumeCommentThread
  permissions: CommentUiPermissions
  onBack: () => void
  onBeginRelink: (threadId: string) => void
  footer?: ReactNode
}) {
  const actions = useCommentActions()
  const [confirmingThreadDelete, setConfirmingThreadDelete] = useState(false)
  const [replyTarget, setReplyTarget] = useState<{
    commentId: string
    displayName: string
  } | null>(null)
  const client = useResumeCommentClient()
  const relinkThreadId = useResumeCommentStore(state => state.relinkThreadId)
  const relinkError = useResumeCommentStore(state => state.relinkError)
  const cancelRelink = useResumeCommentStore(state => state.cancelRelink)
  const accessState = useResumeCommentStore(state => state.accessState)
  const root = thread.comments.find(comment => comment.parentId === null)
  const access = client.getAccessContext()
  const effectivePermissions = {
    ...permissions,
    currentAnonymousId: permissions.currentAnonymousId
      ?? (access.kind === 'share' ? access.anonymous?.id : null),
  }
  const canResolve = permissions.canModerateAll
    || Boolean(root && isCurrentCommentAuthor(root.author, effectivePermissions))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button size="icon-sm" variant="ghost" aria-label="返回评论列表" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate border-l-2 border-amber-300 pl-2 text-xs text-muted-foreground">
            {thread.anchor.exactQuote}
          </p>
        </div>
        {canResolve && !thread.resolvedAt
          ? <Button size="sm" variant="ghost" onClick={() => actions.resolveThread(thread)}>解决</Button>
          : null}
        {canResolve && thread.resolvedAt
          ? (
              <Button size="sm" variant="ghost" onClick={() => actions.reopenThread(thread)}>
                <RotateCcw />
                重开
              </Button>
            )
          : null}
        {permissions.canModerateAll
          ? confirmingThreadDelete
            ? (
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="destructive" onClick={() => actions.deleteThread(thread).then(response => response && onBack())}>确认删除</Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirmingThreadDelete(false)}>取消</Button>
                </div>
              )
            : (
                <Button size="icon-sm" variant="ghost" aria-label="线程菜单" onClick={() => setConfirmingThreadDelete(true)}>
                  <MoreHorizontal />
                </Button>
              )
          : null}
      </header>
      {thread.anchorStatus === 'detached'
        ? (
            <div className="m-3 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>原文字已变化，这条评论暂时无法定位。</p>
              <p className="mt-2 text-xs">
                原选区：“
                {thread.anchor.exactQuote}
                ”
              </p>
              <p className="mt-1 text-xs">
                原字段：
                {formatCommentField(thread.anchor.nodeKey)}
              </p>
              {relinkThreadId === thread.id
                ? (
                    <div className="mt-3 rounded-md bg-background p-2">
                      <p className="text-xs text-foreground">请回到简历正文选择新文字，再点击“关联到此处”。</p>
                      {relinkError ? <p role="alert" className="mt-1 text-xs text-destructive">{relinkError}</p> : null}
                      <Button className="mt-2" size="xs" variant="ghost" onClick={cancelRelink}>取消重新关联</Button>
                    </div>
                  )
                : canResolve
                  ? (
                      <Button className="mt-2" size="sm" variant="outline" onClick={() => onBeginRelink(thread.id)}>
                        <Link2 />
                        重新关联
                      </Button>
                    )
                  : null}
            </div>
          )
        : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <CommentTree
          comments={thread.comments}
          thread={thread}
          permissions={effectivePermissions}
          onReply={setReplyTarget}
        />
      </div>
      {actions.errorMessage
        ? <p role="alert" className="px-4 py-2 text-xs text-destructive">{actions.errorMessage}</p>
        : null}
      {permissions.canCreate && accessState === 'active' && !thread.resolvedAt
        ? (
            <div className="border-t p-3">
              {replyTarget
                ? (
                    <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        回复
                        {' '}
                        {replyTarget.displayName}
                      </span>
                      <Button size="xs" variant="ghost" onClick={() => setReplyTarget(null)}>取消</Button>
                    </div>
                  )
                : null}
              <CommentComposer
                draftKey={`reply:${thread.id}:${replyTarget?.commentId ?? 'root'}`}
                placeholder={replyTarget ? `回复 ${replyTarget.displayName}…` : '回复…'}
                disabled={actions.pendingAction !== null}
                pending={actions.pendingAction === `thread:${thread.id}:reply`}
                onSubmit={async (value) => {
                  const response = await actions.createReply(thread, value, replyTarget?.commentId)
                  if (response)
                    setReplyTarget(null)
                  return Boolean(response)
                }}
              />
            </div>
          )
        : null}
      {footer}
    </div>
  )
}
