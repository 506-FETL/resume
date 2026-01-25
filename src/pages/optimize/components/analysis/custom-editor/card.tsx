import type { MouseEvent, ReactNode } from 'react'
import type { AfterValue, Suggestion, ValueType } from '../../../types'
import type { SkillItem } from '@/lib/schema/resume/form/skillSpecialty'
import { Check, Edit3, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { KIND_CONFIG } from '../../../const'
import { detectValueType, isEmptyValue, renderPreview } from '../../../utils'
import CertificateListEditor from '../../editors/certificate-list-editor'
import DateRangeEditor from '../../editors/date-range-editor'
import ObjectEditor from '../../editors/object-editor'
import SkillListEditor from '../../editors/skill-list-editor'
import StringArrayEditor from '../../editors/string-array-editor'

// 编辑器组件映射
const EDITOR_MAP: Record<string, (props: { value: AfterValue, onChange: (newValue: AfterValue) => void }) => ReactNode> = {
  date_range: ({ value, onChange }) => <DateRangeEditor value={value as string[]} onChange={onChange} />,
  skill_list: ({ value, onChange }) => <SkillListEditor value={value as SkillItem[]} onChange={onChange} />,
  skill_item: ({ value, onChange }) => (
    <SkillListEditor
      value={[value as SkillItem]}
      onChange={updatedList => onChange(updatedList[0])}
    />
  ),
  certificate_list: ({ value, onChange }) => (
    <CertificateListEditor
      value={value as Array<{ name: string }>}
      onChange={onChange}
    />
  ),
  string_array: ({ value, onChange }) => <StringArrayEditor value={value as string[]} onChange={onChange} />,
  object: ({ value, onChange }) => (
    <ObjectEditor
      value={value as Record<string, unknown>}
      onChange={onChange}
    />
  ),
  object_array: ({ value, onChange }) => (
    <div className="space-y-2">
      {(value as Array<Record<string, unknown>>).map((item, index) => (
        <ObjectEditor
          key={`obj-edit-${JSON.stringify(item).slice(0, 30)}`}
          value={item}
          onChange={(newItem) => {
            const newArray = [...(value as Array<Record<string, unknown>>)]
            newArray[index] = newItem
            onChange(newArray)
          }}
        />
      ))}
    </div>
  ),
}

interface SuggestionEditCardProps {
  suggestion: Suggestion
  onChange: (newSuggestion: Suggestion) => void
  onOk?: (suggestions: Suggestion[]) => void
  onReset: () => void
  isModified: boolean
}

function SuggestionEditCard({ suggestion, onChange, onOk, onReset, isModified }: SuggestionEditCardProps) {
  const kindConfig = KIND_CONFIG[suggestion.kind]
  const [isEditing, setIsEditing] = useState(false)
  const [internalValue, setInternalValue] = useState(suggestion.after)

  useEffect(() => {
    setInternalValue(suggestion.after)
  }, [suggestion.after])

  const handleValueChange = useCallback((updatedValue: AfterValue) => {
    setInternalValue(updatedValue)
    onChange({ ...suggestion, after: updatedValue })
  }, [suggestion, onChange])

  const handleOk = () => {
    isEditing && onOk?.([{ ...suggestion, after: internalValue }])
    setIsEditing(!isEditing)
  }

  const handleRestore = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    onReset()
    onOk?.([])
  }, [onReset, onOk])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-card overflow-hidden transition-shadow',
        isEditing && 'ring-2 ring-primary/20 shadow-md',
        isModified && 'border-primary/50',
      )}
    >
      {/* 头部 */}
      <div className={cn(
        'flex flex-col gap-2 p-3 border-b sm:flex-row sm:items-center sm:justify-between sm:px-4',
        suggestion.fixed ? 'bg-green-100/30 dark:bg-green-900/10' : 'bg-muted/30',
      )}
      >
        <div className="flex flex-col gap-1.5 min-w-0 flex-1 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={cn('text-xs px-2 py-0.5 shrink-0', kindConfig.bg, kindConfig.color)}
            >
              {kindConfig.label}
            </Badge>
            {isModified && !suggestion.fixed && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary">
                已修改
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground line-clamp-2 sm:truncate">
            {suggestion.reason}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 justify-end w-full sm:w-auto">
          {isModified && !suggestion.fixed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleRestore}
            >
              <RotateCcw className="size-3 mr-1" />
              还原
            </Button>
          )}
          {suggestion.fixed
            ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-green-600 border-green-200 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:hover:bg-green-900/30 pointer-events-none"
                >
                  <Check className="size-3 mr-1" />
                  已修复
                </Button>
              )
            : (
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleOk}
                >
                  {isEditing
                    ? <Check className="size-3 mr-1" />
                    : <Edit3 className="size-3 mr-1" />}
                  {isEditing ? '确定' : '编辑'}
                </Button>
              )}
        </div>
      </div>

      {/* 内容 */}
      <AnimatePresence mode="wait">
        {isEditing
          ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                <ValueEditor
                  value={internalValue}
                  valueType={suggestion.valueType}
                  onChange={handleValueChange}
                />
              </motion.div>
            )
          : (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-3"
              >
                {/* 修改前 */}
                {!isEmptyValue(suggestion.before) && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">修改前</span>
                    <div className="text-sm text-muted-foreground/70 line-through bg-muted/30 rounded-md p-2 break-all whitespace-pre-wrap">
                      {renderPreview(suggestion.before, suggestion.valueType)}
                    </div>
                  </div>
                )}
                {/* 修改后 */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">修改后</span>
                  <div className={cn(
                    'text-sm rounded-md p-2 border break-all whitespace-pre-wrap',
                    isModified
                      ? 'bg-primary/5 border-primary/20 text-foreground font-medium'
                      : 'bg-emerald-500/5 border-emerald-500/20 text-foreground',
                  )}
                  >
                    {renderPreview(suggestion.after, suggestion.valueType)}
                  </div>
                </div>
              </motion.div>
            )}
      </AnimatePresence>
    </motion.div>
  )
}

function ValueEditor({ value, valueType, onChange }: {
  value: AfterValue
  valueType: ValueType
  onChange: (newValue: AfterValue) => void
}) {
  const detectedType = detectValueType(value)

  if (valueType === 'html_string') {
    return <SimpleEditor content={value as string} onChange={editor => onChange(editor.getHTML())} />
  }

  const Editor = EDITOR_MAP[detectedType]

  if (Editor) {
    return <Editor value={value} onChange={onChange} />
  }

  // 默认使用Tiptap文本编辑器
  return <SimpleEditor content={String(value || '')} onChange={editor => onChange(editor.getHTML())} />
}

export default SuggestionEditCard
