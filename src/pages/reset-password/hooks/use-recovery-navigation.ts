import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RESET_PASSWORD_PATH } from '../const'
import { useRecoveryStore } from '../store'

export function useRecoveryNavigation() {
  const status = useRecoveryStore(state => state.status)
  const initialize = useRecoveryStore(state => state.initialize)
  const shouldRedirect = useRecoveryStore(state => state.shouldRedirect)
  const finishNavigation = useRecoveryStore(state => state.finishNavigation)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    initialize()
  }, [initialize])
  useEffect(() => {
    if (shouldRedirect) {
      navigate(RESET_PASSWORD_PATH, { replace: true })
      finishNavigation()
    }
  }, [finishNavigation, navigate, pathname, shouldRedirect])
  return status === 'checking' || (shouldRedirect && pathname !== RESET_PASSWORD_PATH)
}
