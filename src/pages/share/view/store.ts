import type { ViewState } from './types'
import { createStore } from 'zustand/vanilla'

export function createShareViewStore() {
  return createStore<{ state: ViewState, setState: (state: ViewState) => void }>(set => ({
    state: { phase: 'loading' },
    setState: state => set({ state }),
  }))
}
