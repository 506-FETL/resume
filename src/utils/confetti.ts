import type { GlobalOptions, Options } from 'canvas-confetti'
import type React from 'react'
import confetti from 'canvas-confetti'

export async function startConfetti(
  ref: React.RefObject<HTMLButtonElement | null>,
  options?: Options & GlobalOptions & { canvas?: HTMLCanvasElement },
) {
  if (!ref.current) return

  try {
    const rect = ref.current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    await confetti({
      ...options,
      origin: {
        x: x / window.innerWidth,
        y: y / window.innerHeight,
      },
    })
  } catch (error) {
    console.error('Confetti button error:', error)
  }
}
