export function isTemplateGallery(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/template'
}

let visit: object | undefined
let leave: (() => void) | undefined

export function selectTemplateGallery(selected: boolean) {
  if (!selected) {
    visit = undefined
    leave?.()
    leave = undefined

    return
  }
  if (visit || !isTemplateGallery(window.location.pathname)) return

  const current = {}

  visit = current

  import('@/pages/template/index').catch(() => {})

  Promise.all([
    import('@/store/resume-template/gallery-catalog'),
    import('@/pages/template/store'),
  ])
    .then(([{ useTemplateGalleryCatalog }, { useTemplatePageStore }]) => {
      if (visit !== current) return

      const { loadCatalog, loadFacets } = useTemplateGalleryCatalog.getState()

      const { styleFilter: style, layoutFilter: layout } =
        useTemplatePageStore.getState()

      loadCatalog({ style, layout })
      loadFacets()

      const unsubscribe = useTemplatePageStore.subscribe((next, previous) => {
        if (
          next.styleFilter !== previous.styleFilter ||
          next.layoutFilter !== previous.layoutFilter
        )
          loadCatalog({ style: next.styleFilter, layout: next.layoutFilter })
      })

      leave = () => {
        unsubscribe()

        useTemplatePageStore.setState({
          previewOpen: false,
          previewStep: 'preview',
          previewTarget: null,
          selectedTemplateId: null,
          previewTrigger: null,
        })
      }
    })
    .catch(() => {
      if (visit === current) visit = undefined
    })
}
