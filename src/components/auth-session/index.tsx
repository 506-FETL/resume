import { useEffect } from 'react'
import { startAuthSession, stopAuthSession } from './subscription'

export default function AuthSession() {
  useEffect(() => {
    startAuthSession()

    return stopAuthSession
  }, [])

  return null
}
