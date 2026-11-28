import { MessageSquare, X } from 'lucide-react'
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { guideEnterEase, gsap, useGSAP } from '../motion'

interface CommentDemoProps {
  blocked: boolean
  phase: 'intro' | 'send' | null
  quote: string
  onClose: () => void
  onReady: () => void
}

const mobileQuery = '(max-width: 767px)'

function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(mobileQuery)

  media.addEventListener('change', onChange)

  return () => media.removeEventListener('change', onChange)
}

function readMobile() {
  return window.matchMedia(mobileQuery).matches
}

export default function CommentDemo({
  phase,
  blocked,
  quote,
  onClose,
  onReady,
}: CommentDemoProps) {
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [composer, setComposer] = useState<HTMLDivElement | null>(null)
  const [comment, setComment] = useState<HTMLElement | null>(null)
  const [lastPhase, setLastPhase] = useState(phase ?? 'intro')
  const [lastQuote, setLastQuote] = useState(quote)
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState(false)
  const [filter, setFilter] = useState('open')
  const onReadyRef = useRef(onReady)
  const sendButtonRef = useRef<HTMLButtonElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const readyRef = useRef(false)
  const reduced = useReducedMotion()
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, () => false)
  const displayedPhase = phase ?? lastPhase
  const displayedQuote = phase === null ? lastQuote : quote

  onReadyRef.current = onReady

  useLayoutEffect(() => {
    if (phase === null) return

    setLastPhase(phase)
    setLastQuote(quote)
  }, [phase, quote])

  useLayoutEffect(() => {
    readyRef.current = false

    if (phase === null) return

    setDraft('')
    setSent(false)
    setFilter('open')
  }, [phase])

  useGSAP(
    () => {
      if (!content || phase === null) return

      if (phase === 'intro') {
        gsap.delayedCall(reduced ? 0 : DURATION.slow, () => {
          if (readyRef.current) return

          readyRef.current = true
          onReadyRef.current()
        })

        return
      }
      if (!composer) return
      if (reduced) {
        setSent(true)

        return
      }

      const timeline = gsap.timeline({
        defaults: { duration: DURATION.fast, ease: guideEnterEase },
      })

      timelineRef.current = timeline
      timeline.call(() => setDraft('6'), [], DURATION.base)
      timeline.call(() => setDraft('66'), [], DURATION.base * 2)
      timeline.call(() => setDraft('666'), [], DURATION.base * 3)
      timeline.to(sendButtonRef.current, { scale: 0.96 }, DURATION.base * 4)
      timeline.to(sendButtonRef.current, { scale: 1 })

      timeline.call(() => {
        setDraft('')
        setSent(true)
      })

      return () => {
        timelineRef.current = null
      }
    },
    {
      scope: content ?? undefined,
      dependencies: [content, composer, phase, reduced],
      revertOnUpdate: true,
    },
  )

  useGSAP(
    () => {
      if (!comment || !sent || phase !== 'send') return
      if (readyRef.current) {
        gsap.set(comment, { opacity: 1, y: 0 })

        return
      }

      gsap.fromTo(
        comment,
        { opacity: 0, y: reduced ? 0 : 8 },
        {
          opacity: 1,
          y: 0,
          duration: reduced ? 0 : DURATION.base,
          ease: guideEnterEase,
          onComplete: () => {
            if (readyRef.current) return

            readyRef.current = true
            onReadyRef.current()
          },
        },
      )
    },
    {
      scope: content ?? undefined,
      dependencies: [comment, sent, phase, reduced],
      revertOnUpdate: true,
    },
  )

  const sendDemo = () => {
    timelineRef.current?.kill()
    setDraft('')
    setSent(true)
    setFilter('open')
  }

  return (
    <Drawer
      open={phase !== null}
      modal={false}
      swipeDirection={mobile ? 'down' : 'right'}
      disablePointerDismissal
      onOpenChange={(_open, details) => details.cancel()}
    >
      <DrawerContent
        ref={setContent}
        data-feature-guide-ui
        data-feature-guide-demo='comment'
        data-guide-blocked={blocked || undefined}
        initialFocus={false}
        finalFocus={false}
        className='print:hidden'
        style={
          {
            '--drawer-content-height': mobile ? 'min(360px,55dvh)' : undefined,
            '--drawer-content-max-height': mobile ? '55dvh' : undefined,
            '--drawer-content-width': mobile
              ? undefined
              : 'min(360px,calc(100vw - 1rem))',
          } as CSSProperties
        }
      >
        <DrawerDescription className='sr-only'>划词评论演示</DrawerDescription>
        <header
          data-feature-guide-comment-header
          className='shrink-0 border-b px-4 pt-4 pb-3'
        >
          <div className='flex items-center gap-2'>
            <div className='min-w-0 flex-1'>
              <DrawerTitle className='font-semibold'>评论</DrawerTitle>
              <p className='truncate text-xs text-muted-foreground'>
                当前工作版本
              </p>
            </div>
            <Badge variant='secondary'>演示</Badge>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='关闭评论演示'
              onClick={onClose}
            >
              <X className='size-4' />
            </Button>
          </div>
        </header>
        <Tabs
          value={filter}
          onValueChange={setFilter}
          className='min-h-0 flex-1 gap-0'
        >
          <TabsList className='grid h-auto w-full shrink-0 grid-cols-3 rounded-none border-b bg-transparent p-2'>
            <TabsTrigger value='open' disabled={phase === 'send' && !sent}>
              未解决{' '}
              <span className='text-xs text-muted-foreground'>
                {sent ? 1 : 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value='resolved' disabled={phase === 'send' && !sent}>
              已解决 <span className='text-xs text-muted-foreground'>0</span>
            </TabsTrigger>
            <TabsTrigger value='detached' disabled={phase === 'send' && !sent}>
              失去锚点 <span className='text-xs text-muted-foreground'>0</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value='open' className='min-h-0 overflow-y-auto p-4'>
            {displayedPhase === 'intro' ? (
              <DemoEmpty label='还没有评论' />
            ) : sent ? (
              <article ref={setComment} className='space-y-3' data-guide-sent>
                <p className='border-l-2 border-amber-300 pl-3 text-sm text-muted-foreground'>
                  {displayedQuote}
                </p>
                <div className='flex items-start gap-2.5'>
                  <Avatar size='sm'>
                    <AvatarFallback>我</AvatarFallback>
                  </Avatar>
                  <div className='min-w-0 flex-1'>
                    <div className='mb-1 flex items-center gap-2 text-xs'>
                      <span className='font-medium'>我</span>
                      <span className='text-muted-foreground'>刚刚</span>
                    </div>
                    <p className='text-sm'>666</p>
                  </div>
                </div>
              </article>
            ) : (
              <div ref={setComposer} className='space-y-3' data-guide-sending>
                <p className='border-l-2 border-amber-300 pl-3 text-sm text-muted-foreground'>
                  {displayedQuote}
                </p>
                <Textarea
                  aria-label='演示评论'
                  readOnly
                  tabIndex={-1}
                  value={draft}
                  placeholder='写下你的评论…'
                  className='max-h-40 min-h-20 resize-none'
                />
                <div className='flex items-center justify-between gap-3'>
                  <span className='text-xs text-muted-foreground'>
                    {draft.length} / 2,000
                  </span>
                  <Button ref={sendButtonRef} size='sm' onClick={sendDemo}>
                    发送
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value='resolved' className='min-h-0 overflow-y-auto p-4'>
            <DemoEmpty label='还没有已解决的评论' />
          </TabsContent>
          <TabsContent value='detached' className='min-h-0 overflow-y-auto p-4'>
            <DemoEmpty label='没有失去锚点的评论' />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  )
}

function DemoEmpty({ label }: { label: string }) {
  return (
    <div className='flex min-h-24 flex-col items-center justify-center gap-2 py-8 text-muted-foreground'>
      <MessageSquare aria-hidden className='size-7 opacity-50' />
      <p className='text-sm'>{label}</p>
    </div>
  )
}
