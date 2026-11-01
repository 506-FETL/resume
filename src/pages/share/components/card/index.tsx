import type { Ref } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { Eye, Link2, LockKeyhole, MessageSquareText } from 'lucide-react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE, SPRING, staggerDelay } from '@/lib/motion'
import { SHARE_PURPOSE_LABELS } from '@/lib/share-purpose'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/utils/date'
import {
  SHARE_MOTION,
  SHARE_PURPOSE_ICONS,
  SHARE_STATUS_META,
} from '../../const'
import useShareStore from '../../store'
import { deriveShareStatus } from '../../utils'
import CardActions from '../card-actions'
import VersionBadge from '../version-badge'

interface LinkCardProps {
  ref?: Ref<HTMLDivElement>
  share: ResumeShareRecord
  index: number
  resumeTitle: string
}

export default function LinkCard({
  ref,
  share,
  index,
  resumeTitle,
}: LinkCardProps) {
  const busy = useShareStore((state) =>
    state.pendingShareIds.includes(share.id),
  )

  const reduceMotion = useReducedMotion()
  const status = deriveShareStatus(share)
  const statusMeta = SHARE_STATUS_META[status]
  const title = share.display_name || '未命名简历'
  const PurposeIcon = share.purpose ? SHARE_PURPOSE_ICONS[share.purpose] : Link2

  const purposeLabel =
    share.label ||
    (share.purpose ? SHARE_PURPOSE_LABELS[share.purpose] : '未设置用途')

  const contactLabel = share.showPhone
    ? share.showEmail
      ? '显示联系方式'
      : '仅显示手机号'
    : share.showEmail
      ? '仅显示邮箱'
      : '隐藏联系方式'

  const expiry = share.expires_at
    ? new Date(share.expires_at).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <PresenceDiv
      ref={ref}
      role='listitem'
      className='min-w-0 border-b border-border/60 last:border-b-0'
      layout={reduceMotion ? false : 'position'}
      initial={reduceMotion ? false : SHARE_MOTION.item.initial}
      animate={SHARE_MOTION.item.animate}
      exit={{
        ...(reduceMotion ? { opacity: 0 } : SHARE_MOTION.item.exit),
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          delay: 0,
          ease: EASE.in,
        },
      }}
      transition={{
        ...SHARE_MOTION.item.transition,
        duration: reduceMotion ? 0 : DURATION.base,
        delay: reduceMotion ? 0 : staggerDelay(Math.min(index, 6)),
        layout: reduceMotion ? { duration: 0 } : SPRING.layout,
      }}
    >
      <article
        aria-label={`${title}：${purposeLabel}`}
        aria-busy={busy}
        className='group grid min-w-0 gap-4 px-3 py-5 transition-colors sm:px-4 hover:bg-muted/25 focus-within:bg-muted/25 @min-[600px]/share-links:grid-cols-[minmax(0,1fr)_auto] @min-[600px]/share-links:gap-6'
        style={{
          transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s`,
          transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
      >
        <div className='min-w-0'>
          <div className='flex min-h-5 items-center justify-between gap-3'>
            <h3 className='flex min-w-0 items-start gap-2 text-[15px] leading-snug font-medium'>
              <PurposeIcon
                className='mt-0.5 size-4 shrink-0 text-muted-foreground'
                aria-hidden
              />
              <span className='wrap-anywhere'>{purposeLabel}</span>
            </h3>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-xs',
                statusMeta.textClassName,
              )}
            >
              <span className='size-1.5 rounded-full bg-current' aria-hidden />
              {statusMeta.label}
            </span>
          </div>

          <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs'>
            <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
              <VersionBadge source={share.source} appearance='plain' />
              {share.has_password && (
                <span className='inline-flex items-center gap-1 text-muted-foreground'>
                  <LockKeyhole className='size-3.5' aria-hidden />
                  密码保护
                </span>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground'>
              {share.allowComments ? (
                <MessageSquareText className='size-3.5' aria-hidden />
              ) : (
                <Eye className='size-3.5' aria-hidden />
              )}
              <span>{share.allowComments ? '允许评论' : '仅查看'}</span>
              <span aria-hidden className='text-border'>
                ·
              </span>
              <span>{contactLabel}</span>
            </div>
            {expiry && (
              <p
                className={cn(
                  'text-muted-foreground',
                  status === 'expired' && statusMeta.textClassName,
                )}
                title={new Date(share.expires_at!).toLocaleString('zh-CN')}
              >
                {expiry}
                {status === 'expired' ? '已到期' : '到期'}
              </p>
            )}
          </div>
          {title !== resumeTitle && (
            <p className='mt-2 text-xs text-muted-foreground wrap-anywhere'>
              简历名称：{title}
            </p>
          )}
        </div>

        <div className='flex min-w-0 flex-col gap-3 @min-[600px]/share-links:justify-center'>
          <dl className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground @min-[600px]/share-links:justify-end'>
            <div className='flex shrink-0 items-center gap-1.5'>
              <dt className='inline-flex items-center'>
                <Eye className='size-3.5' aria-hidden />
                <span className='sr-only'>访问次数，包含重复访问</span>
              </dt>
              <dd>
                <span className='font-medium text-foreground tabular-nums'>
                  {share.view_count.toLocaleString()}
                </span>{' '}
                次访问
              </dd>
            </div>
            <div className='min-w-0'>
              <dt className='sr-only'>最近访问</dt>
              <dd
                className='wrap-anywhere'
                title={
                  share.last_viewed_at
                    ? new Date(share.last_viewed_at).toLocaleString('zh-CN')
                    : undefined
                }
              >
                {share.last_viewed_at
                  ? `${formatRelativeTime(share.last_viewed_at)}访问`
                  : '暂无访问'}
              </dd>
            </div>
          </dl>
          <CardActions share={share} />
        </div>
      </article>
    </PresenceDiv>
  )
}
