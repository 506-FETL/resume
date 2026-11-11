import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile('src/pages/resume/index.tsx', 'utf8')

const file = ts.createSourceFile(
  'resume.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

let effect

function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(file) === 'useEffect' &&
    node.arguments[0]?.getText(file).includes('refreshLibrary()')
  ) {
    effect = node
  }

  ts.forEachChild(node, visit)
}

visit(file)
assert.ok(effect, '正式 ResumePage 必须有简历初始化 effect')

const compile = new Function(
  'authStatus',
  'user',
  'refreshLibrary',
  'useResumeListStore',
  `return { run: ${effect.arguments[0].getText(file)}, dependencies: ${effect.arguments[1].getText(file)} }`,
)

let reads = 0
let cancels = 0
let previous = []
let cleanup

const refreshLibrary = () => {
  reads += 1
}

const store = {
  getState: () => ({
    cancelLibraryLoad: () => {
      cancels += 1
    },
  }),
}

function render(status, id) {
  const current = compile(status, id ? { id } : null, refreshLibrary, store)

  if (
    current.dependencies.every((value, index) =>
      Object.is(value, previous[index]),
    )
  )
    return

  cleanup?.()
  cleanup = current.run()
  previous = current.dependencies
}

render('unknown', null)
assert.equal(reads, 0)
render('authenticated', 'A')
assert.equal(reads, 1)
render('authenticated', 'A')
assert.equal(reads, 1, '同账户重新渲染不重复刷新')
render('authenticated', 'B')
assert.equal(reads, 2)
assert.equal(cancels, 1)
render('authenticated', 'A')
assert.equal(reads, 3)
render('anonymous', null)
assert.equal(reads, 4)
cleanup?.()
assert.equal(cancels, 4)

process.stdout.write(
  `${JSON.stringify({ passed: 5, evidence: '直接提取并执行正式 ResumePage 的 effect 和依赖表达式；未复制 effect 逻辑', checks: ['身份未知零读取', '初始化后仅一次刷新', '同账户重渲染无刷新', 'A→B→A清理并重载', '登出与卸载清理'] }, null, 2)}\n`,
)
