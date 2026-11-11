import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

export async function loadSource(entry, overrides = {}) {
  const modules = new Map()

  async function readModule(file) {
    if (modules.has(file)) return modules.get(file)

    const source = await readFile(file, 'utf8').catch(async (error) => {
      if (error.code !== 'ENOENT') throw error

      file = `${file.slice(0, -3)}/index.ts`

      return readFile(file, 'utf8')
    })

    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })

    const module = new vm.SourceTextModule(outputText, { identifier: file })

    modules.set(file, module)

    return module
  }

  async function link(specifier, parent) {
    if (overrides[specifier]) {
      if (modules.has(specifier)) return modules.get(specifier)

      const exports = overrides[specifier]

      const module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports))
          this.setExport(key, value)
      })

      modules.set(specifier, module)

      return module
    }

    if (!specifier.startsWith('@/') && !specifier.startsWith('.')) {
      if (modules.has(specifier)) return modules.get(specifier)

      const exports = await import(specifier)

      const module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports))
          this.setExport(key, value)
      })

      modules.set(specifier, module)

      return module
    }

    const file =
      specifier === '@/utils'
        ? 'src/utils/error.ts'
        : specifier.startsWith('@/')
          ? `src/${specifier.slice(2)}.ts`
          : path.resolve(
              path.dirname(parent.identifier),
              specifier.endsWith('.ts') ? specifier : `${specifier}.ts`,
            )

    return readModule(path.resolve(file))
  }

  const module = await readModule(path.resolve(entry))

  await module.link(link)
  await module.evaluate()

  return module.namespace
}
