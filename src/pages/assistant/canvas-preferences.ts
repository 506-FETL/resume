import {
  ASSISTANT_CANVAS_STORAGE_KEY,
  ASSISTANT_CANVAS_WIDTH_STORAGE_KEY,
  CANVAS_DEFAULT_WIDTH,
  CANVAS_MAX_WIDTH,
  CANVAS_MIN_WIDTH,
} from './const'

export function readAssistantCanvasPreferences() {
  let open = true
  let width = CANVAS_DEFAULT_WIDTH

  try {
    const storedOpen = localStorage.getItem(ASSISTANT_CANVAS_STORAGE_KEY)

    const storedWidth = Number(
      localStorage.getItem(ASSISTANT_CANVAS_WIDTH_STORAGE_KEY),
    )

    open = storedOpen === null || storedOpen === 'true'

    if (Number.isFinite(storedWidth) && storedWidth > 0)
      width = Math.min(
        CANVAS_MAX_WIDTH,
        Math.max(CANVAS_MIN_WIDTH, storedWidth),
      )
  } catch {}

  return { open, width }
}
