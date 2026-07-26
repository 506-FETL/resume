import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass-embedded'

const stylesheetPath = fileURLToPath(new URL(
  '../../../components/tiptap-node/paragraph-node/paragraph-node.scss',
  import.meta.url,
))

function getCaretDeclarations() {
  const css = compile(stylesheetPath).css
  const match = css.match(
    /(?:^|\})\s*\.tiptap\.ProseMirror \.collaboration-carets__caret\s*\{([^}]*)\}/m,
  )
  assert.ok(match?.[1], 'compiled caret selector must exist')
  return new Map(match[1]
    .split(';')
    .map(declaration => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(':')
      assert.notEqual(separator, -1, `invalid declaration: ${declaration}`)
      return [
        declaration.slice(0, separator).trim(),
        declaration.slice(separator + 1).trim(),
      ] as const
    }))
}

test('caret selector defines a zero-net-width atomic inline box', () => {
  const declarations = getCaretDeclarations()

  assert.equal(declarations.get('display'), 'inline-block')
  assert.equal(declarations.get('width'), '0')
  assert.equal(declarations.get('height'), '1em')
  assert.equal(declarations.get('vertical-align'), 'text-bottom')
  assert.equal(declarations.get('border-left'), '1px solid transparent')
  assert.equal(declarations.get('border-right'), '1px solid transparent')
  assert.equal(declarations.get('margin-left'), '-1px')
  assert.equal(declarations.get('margin-right'), '-1px')
})
