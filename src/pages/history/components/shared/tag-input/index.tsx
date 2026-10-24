import { Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHistoryDialogMotion } from '../../../hooks/use-history-dialog-motion'

interface VersionTagInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

export default function VersionTagInput({
  value,
  onChange,
}: VersionTagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const dialogMotion = useHistoryDialogMotion()

  const appendTag = () => {
    const nextValue = inputValue.trim()

    if (!nextValue) {
      return
    }

    if (value.includes(nextValue)) {
      setInputValue('')

      return
    }

    onChange([...value, nextValue])
    setInputValue('')
  }

  return (
    <motion.div
      layout={!dialogMotion.reduceMotion}
      transition={{ layout: dialogMotion.layoutTransition }}
      className='flex flex-col gap-3'
    >
      <div className='relative flex min-h-7 flex-wrap gap-2'>
        <AnimatePresence initial={false} mode='popLayout'>
          {value.length > 0 ? (
            value.map((tag) => (
              <motion.div
                key={`tag:${tag}`}
                layout={!dialogMotion.reduceMotion}
                initial={{
                  opacity: 0,
                  scale: dialogMotion.reduceMotion ? 1 : 0.9,
                  y: dialogMotion.reduceMotion ? 0 : 4,
                }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: dialogMotion.reduceMotion ? 1 : 0.9,
                  transition: dialogMotion.exitTransition,
                }}
                transition={{
                  ...dialogMotion.enterTransition,
                  layout: dialogMotion.layoutTransition,
                }}
              >
                <Badge variant='secondary' className='gap-1.5 px-2 py-1'>
                  {tag}
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    className='-mr-1 size-4 rounded-full'
                    aria-label={`移除标签 ${tag}`}
                    onClick={() =>
                      onChange(value.filter((item) => item !== tag))
                    }
                  >
                    <X />
                  </Button>
                </Badge>
              </motion.div>
            ))
          ) : (
            <motion.span
              key='empty'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: dialogMotion.exitTransition }}
              transition={dialogMotion.enterTransition}
              className='self-center text-sm text-muted-foreground'
            >
              暂未添加标签
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className='flex flex-col gap-2 sm:flex-row'>
        <Input
          value={inputValue}
          placeholder='输入标签后按回车，例如：春招、投递版'
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              appendTag()
            }
          }}
        />
        <Button type='button' variant='outline' onClick={appendTag}>
          <Plus data-icon='inline-start' />
          添加标签
        </Button>
      </div>
    </motion.div>
  )
}
