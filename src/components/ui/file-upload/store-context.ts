'use client'

import * as React from 'react'
import type { Store, StoreState } from './types'
import { ROOT_NAME } from './constants'
import { useRefWithInit } from '@/hooks/use-ref-with-init'

export const StoreContext = React.createContext<Store | null>(null)

export function useStoreContext(consumerName: string) {
  const context = React.useContext(StoreContext)

  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``)
  }

  return context
}

export function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext('useStore')

  const lastValueRef = useRefWithInit<{ value: T; state: StoreState } | null>(
    () => null,
  )

  const getSnapshot = React.useCallback(() => {
    const state = store.getState()
    const prevValue = lastValueRef.current

    if (prevValue && prevValue.state === state) {
      return prevValue.value
    }

    const nextValue = selector(state)

    lastValueRef.current = { value: nextValue, state }

    return nextValue
  }, [store, selector, lastValueRef])

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
