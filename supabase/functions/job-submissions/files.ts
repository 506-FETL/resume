import { unzipSync } from 'npm:fflate@0.8.3'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser@5.11.2'

export const MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024

interface PackageXmlElement {
  localName: string
  namespace: string | undefined
  namespaces: Record<string, string>
  attributes: Record<string, string>
  children: Record<string, unknown>[]
}

function readXmlElement(
  node: Record<string, unknown>,
  inheritedNamespaces: Record<string, string> = {},
): PackageXmlElement | null {
  const name = Object.keys(node).find(
    (key) => key !== ':@' && !key.startsWith('#') && !key.startsWith('?'),
  )

  if (!name) return null

  const attributes = (node[':@'] ?? {}) as Record<string, string>
  const namespaces = { ...inheritedNamespaces }

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'xmlns') namespaces[''] = value
    else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value
  }

  const separator = name.indexOf(':')
  const prefix = separator < 0 ? '' : name.slice(0, separator)

  return {
    localName: separator < 0 ? name : name.slice(separator + 1),
    namespace: namespaces[prefix],
    namespaces,
    attributes,
    children: node[name] as Record<string, unknown>[],
  }
}

function parsePackageXmlRoot(text: string): PackageXmlElement {
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
  })

  const roots = (parser.parse(text) as Record<string, unknown>[])
    .map((node) => readXmlElement(node))
    .filter((node) => node !== null)

  if (roots.length !== 1) throw new Error('DOCX 文档根元素无效')

  return roots[0]
}

function hasPackageChild(
  root: PackageXmlElement,
  name: string,
  predicate: (attributes: Record<string, string>) => boolean,
) {
  return root.children.some((node) => {
    const child = readXmlElement(node, root.namespaces)

    return (
      child?.localName === name &&
      child.namespace === root.namespace &&
      predicate(child.attributes)
    )
  })
}

function isMainDocumentTarget(target: string | undefined) {
  if (
    !target ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith('//') ||
    target.includes('\\')
  )
    return false

  const resolved = new URL(target, 'https://package.invalid/')

  return (
    resolved.pathname === '/word/document.xml' &&
    !resolved.search &&
    !resolved.hash
  )
}

export async function validateSubmissionFile(file: File) {
  if (!file.size || file.size > MAX_SUBMISSION_FILE_SIZE)
    throw new Error('文件须为 10 MB 以内的 PDF 或 DOCX')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const extension = file.name.split('.').pop()?.toLowerCase()
  const decoder = new TextDecoder()
  const pdf = 'application/pdf'

  const docx =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  if (extension === 'pdf' && file.type === pdf) {
    if (
      decoder.decode(bytes.subarray(0, 5)) !== '%PDF-' ||
      !decoder.decode(bytes.subarray(-2048)).includes('%%EOF') ||
      !decoder.decode(bytes).includes('/Type')
    )
      throw new Error('PDF 内容无效，请重新选择原文件')

    try {
      const document = await PDFDocument.load(bytes, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      })

      if (!document.getPageCount()) throw new Error('empty_pdf')
    } catch {
      throw new Error('PDF 无法读取，请选择未加密的完整原文件')
    }
  } else if (extension === 'docx' && file.type === docx) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new Error('DOCX 内容无效，请重新选择原文件')

    let totalSize = 0
    let entries = 0

    const required = new Set([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
    ])

    const files = unzipSync(bytes, {
      filter: (entry) => {
        totalSize += entry.originalSize
        entries++

        if (totalSize > 50 * 1024 * 1024 || entries > 2000)
          throw new Error('DOCX 解压后过大')

        return required.has(entry.name)
      },
    })

    if (
      [...required].some(
        (name) =>
          !files[name]?.length ||
          XMLValidator.validate(decoder.decode(files[name])) !== true,
      )
    )
      throw new Error('DOCX 文档结构无效')

    const document = parsePackageXmlRoot(
      decoder.decode(files['word/document.xml']),
    )

    const contentTypes = parsePackageXmlRoot(
      decoder.decode(files['[Content_Types].xml']),
    )

    const relationships = parsePackageXmlRoot(
      decoder.decode(files['_rels/.rels']),
    )

    if (
      document.localName !== 'document' ||
      ![
        'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'http://purl.oclc.org/ooxml/wordprocessingml/main',
      ].includes(document.namespace ?? '') ||
      contentTypes.localName !== 'Types' ||
      contentTypes.namespace !==
        'http://schemas.openxmlformats.org/package/2006/content-types' ||
      !hasPackageChild(
        contentTypes,
        'Override',
        (attributes) =>
          attributes.PartName === '/word/document.xml' &&
          attributes.ContentType ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
      ) ||
      relationships.localName !== 'Relationships' ||
      relationships.namespace !==
        'http://schemas.openxmlformats.org/package/2006/relationships' ||
      !hasPackageChild(
        relationships,
        'Relationship',
        (attributes) =>
          (attributes.TargetMode === undefined ||
            attributes.TargetMode === 'Internal') &&
          [
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
            'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument',
          ].includes(attributes.Type) &&
          isMainDocumentTarget(attributes.Target),
      )
    )
      throw new Error('文件不包含完整 DOCX 文档')
  } else {
    throw new Error('请选择文件类型匹配的 PDF 或 DOCX')
  }

  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')

  return { bytes, hash, extension, mime: file.type }
}
