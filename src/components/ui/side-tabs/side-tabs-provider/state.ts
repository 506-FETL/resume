'use client'

import type { SideTabsState, SideTabsAction } from './types'

export function reducer(
  state: SideTabsState,
  action: SideTabsAction,
): SideTabsState {
  switch (action.type) {
    case 'set-active': {
      const next =
        typeof action.value === 'function'
          ? action.value(state.active)
          : action.value

      return next === state.active ? state : { ...state, active: next }
    }

    case 'set-box': {
      const prev = state.box
      const next = action.value

      if (
        prev.x === next.x &&
        prev.y === next.y &&
        prev.w === next.w &&
        prev.h === next.h &&
        prev.totalHeight === next.totalHeight
      ) {
        return state
      }

      return { ...state, box: next }
    }

    case 'set-outline': {
      return state.outlineD === action.value
        ? state
        : { ...state, outlineD: action.value }
    }

    default:
      return state
  }
}
