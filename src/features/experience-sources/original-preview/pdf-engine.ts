let engine: ReturnType<typeof importEngine> | undefined

function importEngine() {
  return Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
}

export function loadPdfEngine() {
  engine ??= importEngine().catch((error: unknown) => {
    engine = undefined

    throw error
  })

  return engine
}
