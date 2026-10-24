import type { KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DURATION, EASE, SPRING } from '@/lib/motion'

function StringArrayEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (val: string[]) => void
  placeholder?: string
}) {
  const reduceMotion = useReducedMotion()
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setInputValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      {/* 已添加的标签 */}
      <AnimatePresence initial={false}>
        {value.length > 0 && (
          <PresenceDiv
            key='tags'
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.fast,
              ease: EASE.out,
            }}
            className='flex flex-wrap gap-2 overflow-hidden'
          >
            <AnimatePresence mode='popLayout' initial={false}>
              {value.map((item) => (
                <PresenceDiv
                  layout={reduceMotion ? false : 'position'}
                  key={`tag-${item}`}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: DURATION.fast,
                          ease: EASE.out,
                          layout: SPRING.layout,
                        }
                  }
                >
                  <Badge
                    variant='secondary'
                    className='text-sm px-3 py-1 gap-1.5 pr-1.5 hover:bg-secondary/80 transition-colors'
                  >
                    {item}
                    <button
                      type='button'
                      className='size-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors'
                      onClick={() => onChange(value.filter((v) => v !== item))}
                    >
                      <X className='size-3' />
                    </button>
                  </Badge>
                </PresenceDiv>
              ))}
            </AnimatePresence>
          </PresenceDiv>
        )}
      </AnimatePresence>

      {/* 输入框 */}
      <div className='flex gap-2'>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '输入后按回车添加'}
          className='flex-1 h-9'
        />
        <Button
          variant='outline'
          size='sm'
          className='h-9'
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          <Plus className='size-4' />
        </Button>
      </div>
    </div>
  )
}

export default StringArrayEditor
