import type { Suggestion } from '@/pages/optimize/types'
import { CodeSnippet } from '@/components/ui/code-snippet'

export default function CodeComparison({
  suggestions,
}: {
  suggestions: Suggestion[]
}) {
  return (
    <div className='grid gap-3 sm:grid-cols-1 lg:grid-cols-2 lg:gap-6'>
      {(['before', 'after'] as const).map((side) => (
        <CodeSnippet
          key={side}
          language='json'
          filename={`${side}.json`}
          className='text-sm lg:text-base'
          showLineNumbers
        >
          {JSON.stringify(
            suggestions.map((suggestion) => suggestion[side] ?? null),
            null,
            2,
          )}
        </CodeSnippet>
      ))}
    </div>
  )
}
