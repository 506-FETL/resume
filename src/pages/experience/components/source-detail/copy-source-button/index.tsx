import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { readExperienceSourceText } from '@/lib/experience-sources/api'
import { DURATION, EASE } from '@/lib/motion'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useExperiencePageStore } from '../../../store'

type CopySourceButtonProps = { sourceId: string; versionId: string }

export function CopySourceButton(props: CopySourceButtonProps) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return (
    <CopyButton
      key={`${generation}:${props.sourceId}:${props.versionId}`}
      {...props}
    />
  )
}

function CopyButton({ sourceId, versionId }: CopySourceButtonProps) {
  const [busy, setBusy] = useState(false)
  const textRef = useRef<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const reduced = useReducedMotion()
  const present = useIsPresent()

  useEffect(() => {
    if (!present) controllerRef.current?.abort()

    return () => controllerRef.current?.abort()
  }, [present])

  async function copy() {
    if (controllerRef.current || !present) return

    const controller = new AbortController()
    const signal = controller.signal
    const generation = useExperienceSourcesStore.getState().generation
    const selection = useExperiencePageStore.getState()

    controllerRef.current = controller
    setBusy(true)

    const stopAccount = useExperienceSourcesStore.subscribe((state) => {
      if (state.generation !== generation) controller.abort()
    })

    const stopSelection = useExperiencePageStore.subscribe((state) => {
      if (
        state.sourceId !== selection.sourceId ||
        state.versionId !== selection.versionId ||
        state.navigationGeneration !== selection.navigationGeneration
      )
        controller.abort()
    })

    try {
      const clipboard = navigator.clipboard

      if (!clipboard) throw new Error('当前浏览器无法访问剪贴板。')

      const content = (
        textRef.current === null
          ? readExperienceSourceText({ sourceId, versionId, signal })
          : Promise.resolve({ text: textRef.current })
      ).then(({ text }) => {
        signal.throwIfAborted()
        textRef.current = text

        return text
      })

      // 在点击事件内开始写入，Safari 也能保留读取全文所需的用户手势。
      const write =
        typeof ClipboardItem !== 'undefined' && clipboard.write
          ? clipboard.write([
              new ClipboardItem({
                'text/plain': content.then(
                  (text) => new Blob([text], { type: 'text/plain' }),
                ),
              }),
            ])
          : content.then((text) => clipboard.writeText(text))

      await Promise.all([content, write])
      signal.throwIfAborted()
      toast.success('已复制全部文字')
    } catch {
      if (!signal.aborted) toast.error('复制失败，请重试或手动选择文字复制。')
    } finally {
      stopAccount()
      stopSelection()
      controllerRef.current = null
      setBusy(false)
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      disabled={busy || !present}
      aria-busy={busy}
      onClick={copy}
    >
      <AnimatePresence initial={false} mode='wait'>
        <motion.span
          key={busy ? 'copying' : 'idle'}
          className='inline-flex size-4 items-center justify-center'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
        >
          {busy ? <Spinner /> : <Copy />}
        </motion.span>
      </AnimatePresence>
      复制全文
    </Button>
  )
}
