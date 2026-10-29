import { RefreshCcw, Search } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import useAtsStore from '../../../store'

interface AnalysisActionsProps {
  hasAnalysis: boolean
  isProcessing: boolean
  onViewAnalysis: () => void
  onStartAnalysis: () => void
}

export function AnalysisActions({
  hasAnalysis,
  isProcessing,
  onViewAnalysis,
  onStartAnalysis,
}: AnalysisActionsProps) {
  const selectedResumeId = useAtsStore((s) => s.selectedResumeId)

  return (
    <>
      {hasAnalysis && (
        <Button variant='secondary' size='sm' onClick={onViewAnalysis}>
          <Search />
          查看分析
        </Button>
      )}

      <Button
        variant='default'
        size='sm'
        onClick={onStartAnalysis}
        disabled={isProcessing || !selectedResumeId}
      >
        {isProcessing ? (
          <Spinner className='motion-reduce:animate-none' />
        ) : (
          <RefreshCcw />
        )}
        {hasAnalysis ? '重新检测' : '开始检测'}
      </Button>
    </>
  )
}
