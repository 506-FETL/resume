import { PX_TO_MM } from '../const'

export interface DocHtmlOptions {
  fontFamily: string
  baseFontSize: number
  lineHeight: number
  pageMargin: number
  badgeBackground: string
  textPrimary: string
}

/** Word 使用同一份渲染后的确定样式，降为连续文档，不维护模板类名映射。 */
export function createResumeDocHtml(
  contentHtml: string,
  options: DocHtmlOptions,
) {
  const document = new DOMParser().parseFromString(contentHtml, 'text/html')
  document
    .querySelectorAll(
      'script, style, iframe, object, embed, button, [data-resume-decoration], svg',
    )
    .forEach((node) => node.remove())
  for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        attribute.name === 'class' ||
        attribute.name.startsWith('data-comment')
      )
        element.removeAttribute(attribute.name)
    }
    const style = element.style
    if (style.display === 'grid' || style.display === 'flex') {
      style.display = 'block'
      for (const child of Array.from(element.children)) {
        if (child instanceof HTMLElement) child.style.marginBottom ||= '4px'
      }
    }
    style.removeProperty('grid-template-columns')
    style.removeProperty('position')
    style.removeProperty('top')
    style.removeProperty('left')
    style.removeProperty('right')
    style.removeProperty('bottom')
    style.removeProperty('height')
    style.removeProperty('max-height')
    style.removeProperty('overflow')
    style.removeProperty('width')
    style.removeProperty('max-width')
    // 矢量色带已移除；其上的白字转换为正文颜色，避免丢失标题。
    if (['rgb(255, 255, 255)', '#ffffff', 'white'].includes(style.color))
      style.color = options.textPrimary
  }
  const margin = (options.pageMargin * PX_TO_MM).toFixed(2)
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Resume</title>
<style>
@page { size: A4; margin: ${margin}mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ${options.fontFamily}; font-size: ${options.baseFontSize}px; line-height: ${options.lineHeight}; color: ${options.textPrimary}; background: white; }
p { margin: 0 0 6px; } ul, ol { padding-left: 24px; margin: 0 0 6px; }
a { color: inherit; } img { max-width: 100%; }
</style></head><body>${document.body.innerHTML}</body></html>`
}
