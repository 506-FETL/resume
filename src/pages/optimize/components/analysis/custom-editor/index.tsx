import type { Suggestion } from '../../../types'
import { Edit3, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import SuggestionEditCard from './card'

interface SuggestionEditorProps {
  suggestions: Suggestion[]
  onChange?: (suggestions: Suggestion[]) => void
  onOk?: (suggestions: Suggestion[]) => void
}

function CustomEditor({ suggestions: initialSuggestions, onChange, onOk }: SuggestionEditorProps) {
  const [currentSuggestions, setCurrentSuggestions] = useState(initialSuggestions)
  const [originalSuggestions] = useState(initialSuggestions)

  useEffect(() => {
    setCurrentSuggestions(initialSuggestions)
  }, [initialSuggestions])

  const handleSuggestionChange = useCallback((index: number, updatedSuggestion: Suggestion) => {
    const newSuggestions = [...currentSuggestions]
    newSuggestions[index] = updatedSuggestion

    setCurrentSuggestions(newSuggestions)
    onChange?.(newSuggestions)
  }, [currentSuggestions, onChange])

  const handleReset = useCallback((index: number) => {
    const newSuggestions = [...currentSuggestions]
    newSuggestions[index] = originalSuggestions[index]
    setCurrentSuggestions(newSuggestions)
    onChange?.(newSuggestions)
  }, [currentSuggestions, originalSuggestions, onChange])

  const handleResetAll = useCallback(() => {
    setCurrentSuggestions(originalSuggestions)
    onChange?.(originalSuggestions)
  }, [originalSuggestions, onChange])

  const isModified = (index: number) => {
    return JSON.stringify(currentSuggestions[index]) !== JSON.stringify(originalSuggestions[index])
  }

  const hasAnyModification = currentSuggestions.some((_, i) => isModified(i))

  if (currentSuggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Edit3 className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">暂无可编辑的建议</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          共
          {' '}
          <span className="font-medium text-foreground">{currentSuggestions.length}</span>
          {' '}
          条建议
          {hasAnyModification && (
            <span className="text-primary ml-1">
              ·
              {' '}
              {currentSuggestions.filter((_, i) => isModified(i)).length}
              {' '}
              条已修改
            </span>
          )}
        </p>
        {hasAnyModification && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleResetAll}
          >
            <RotateCcw className="size-3 mr-1" />
            全部还原
          </Button>
        )}
      </div>

      {/* 建议卡片列表 */}
      <div className="space-y-3">
        {currentSuggestions.map((suggestion, index) => (
          <SuggestionEditCard
            key={`edit-${suggestion.reason}-${suggestion.kind}`}
            suggestion={suggestion}
            onChange={updatedSuggestion => handleSuggestionChange(index, updatedSuggestion)}
            onReset={() => handleReset(index)}
            isModified={isModified(index)}
            onOk={onOk}
          />
        ))}
      </div>
    </div>
  )
}

export default CustomEditor
