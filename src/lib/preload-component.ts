export function preloadComponent<T>(
  importModule: () => Promise<{ default: T }>,
) {
  let ready: T | undefined

  return {
    get ready() {
      return ready
    },
    load: () =>
      importModule().then((module) => {
        ready = module.default

        return module
      }),
  }
}
