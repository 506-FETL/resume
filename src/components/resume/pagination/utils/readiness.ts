export async function waitForResumeFont(
  targetDocument: Document,
  familyName: string,
  weights: number[],
) {
  if (!targetDocument.fonts) throw new Error('当前浏览器不支持字体状态检测')

  // Safari 的字体就绪状态依赖样式与布局解析，先触发正文实际使用的字体分片加载。
  targetDocument.body.getBoundingClientRect()

  const loadedFaces = await Promise.all(
    weights.map((weight) =>
      targetDocument.fonts.load(`${weight} 16px "${familyName}"`),
    ),
  )

  if (loadedFaces.some((faces) => faces.length === 0))
    throw new Error(`字体 ${familyName} 未注册`)

  await targetDocument.fonts.ready

  const ready = weights.every((weight) =>
    targetDocument.fonts.check(`${weight} 16px "${familyName}"`),
  )

  if (!ready) throw new Error(`字体 ${familyName} 加载失败`)
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/** 图片解码完成前不发布稳定布局，打印副本执行相同门禁。 */
export async function waitForResumeImages(root: HTMLElement | Document) {
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map(async (image) => {
      let timer: ReturnType<typeof setTimeout> | undefined

      try {
        await Promise.race([
          image.decode(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('简历图片加载超时')),
              10000,
            )
          }),
        ])

        if (!image.naturalWidth || !image.naturalHeight)
          throw new Error('简历图片加载失败')
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}
