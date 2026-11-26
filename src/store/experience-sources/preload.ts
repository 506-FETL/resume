let opening: { key: string; request: Promise<unknown> } | undefined

export function clearExperiencePreload() {
  opening = undefined
}

export function prepareExperienceRequest(
  key: string,
  load: () => Promise<unknown>,
) {
  if (opening?.key !== key) opening = { key, request: load() }

  return opening.request.then(
    () => {},
    () => {},
  )
}

export function takeExperiencePreload<T>(key: string) {
  if (opening?.key !== key) return

  const current = opening

  // 同一次挂载的消费者共用早到的失败，下一次主动读取可以重新请求。
  queueMicrotask(() => {
    if (opening === current) clearExperiencePreload()
  })

  return current.request as Promise<T>
}
