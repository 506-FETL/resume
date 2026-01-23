import type { KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function StringArrayEditor({ value, onChange, placeholder }: {
  value: string[]
  onChange: (val: string[]) => void
  placeholder?: string
}) {
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
    <div className="space-y-3">
      {/* 已添加的标签 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {value.map(item => (
              <motion.div
                layout
                key={`tag-${item}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ opacity: { duration: 0.15 }, layout: { duration: 0.15 }, scale: { duration: 0.15 } }}
              >
                <Badge
                  variant="secondary"
                  className="text-sm px-3 py-1 gap-1.5 pr-1.5 hover:bg-secondary/80 transition-colors"
                >
                  {item}
                  <button
                    type="button"
                    className="size-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
                    onClick={() => onChange(value.filter(v => v !== item))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '输入后按回车添加'}
          className="flex-1 h-9"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export default StringArrayEditor
