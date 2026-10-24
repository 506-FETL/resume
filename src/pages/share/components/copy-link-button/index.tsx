import { Check, Copy } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      if (timerRef.current) clearTimeout(timerRef.current)
      setCopied(true)
      timerRef.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('复制失败，请手动复制链接')
    }
  }

  return (
    <Button
      variant='ghost'
      size='sm'
      className='h-8 w-17 shrink-0 rounded-md px-1.5'
      aria-label={copied ? '链接已复制' : '复制链接'}
      onClick={handleCopy}
    >
      <AnimatePresence initial={false} mode='wait'>
        <motion.span
          key={String(copied)}
          className='inline-flex items-center gap-1.5'
          initial={{ opacity: 0, y: reduceMotion ? 0 : 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
          transition={{
            duration: reduceMotion ? 0 : DURATION.fast,
            ease: EASE.out,
          }}
        >
          {copied ? (
            <Check className='size-3.5 text-emerald-600' />
          ) : (
            <Copy className='size-3.5' />
          )}
          <span className='text-xs'>{copied ? '已复制' : '复制'}</span>
        </motion.span>
      </AnimatePresence>
      <span role='status' className='sr-only'>
        {copied ? '链接已复制' : ''}
      </span>
    </Button>
  )
}
