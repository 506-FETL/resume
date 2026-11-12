import { useEffect, useState } from 'react'

// 只延后视觉提示；调用方的禁用、读屏状态仍直接使用 busy。
export function useDelayedBusy(busy: boolean, delay = 200) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)

    if (!busy) return

    const timer = window.setTimeout(() => setVisible(true), delay)

    return () => window.clearTimeout(timer)
  }, [busy, delay])

  return busy && visible
}
