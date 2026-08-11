import { useEffect } from 'react'
import useShareStore from '../store'

export function useSharePageBootstrap() {
  const { bootstrapPage } = useShareStore()

  useEffect(() => {
    bootstrapPage().catch(() => undefined)
  }, [bootstrapPage])
}
