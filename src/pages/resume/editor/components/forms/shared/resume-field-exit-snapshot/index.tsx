import type { ReactNode } from 'react'
import { useIsPresent } from 'motion/react'
import { Component, createRef } from 'react'

interface FieldContentProps {
  present: boolean
  children: ReactNode
}

// 退出只保留静态画面；RHF 控件必须立即卸载，避免旧索引的延迟清理影响相邻字段。
class FieldContent extends Component<FieldContentProps> {
  contentRef = createRef<HTMLDivElement>()
  snapshotRef = createRef<HTMLDivElement>()

  getSnapshotBeforeUpdate(previous: FieldContentProps) {
    if (!previous.present || this.props.present) return null

    const source = this.contentRef.current

    if (!source) return null

    const snapshot = source.cloneNode(true) as HTMLDivElement
    const controls = source.querySelectorAll('input, textarea, select')

    snapshot
      .querySelectorAll('input, textarea, select')
      .forEach((node, index) => {
        const original = controls[index]

        if (
          node instanceof HTMLInputElement &&
          original instanceof HTMLInputElement
        ) {
          node.value = original.value
          node.checked = original.checked
        } else if (
          (node instanceof HTMLTextAreaElement &&
            original instanceof HTMLTextAreaElement) ||
          (node instanceof HTMLSelectElement &&
            original instanceof HTMLSelectElement)
        )
          node.value = original.value
      })

    snapshot.querySelectorAll('[id], [name]').forEach((node) => {
      node.removeAttribute('id')
      node.removeAttribute('name')
    })

    return snapshot
  }

  componentDidUpdate(
    _previous: FieldContentProps,
    _state: Readonly<unknown>,
    snapshot: Node | null,
  ) {
    const target = this.snapshotRef.current

    if (!target) return
    if (this.props.present) {
      target.replaceChildren()

      return
    }
    if (snapshot) target.replaceChildren(...Array.from(snapshot.childNodes))
  }

  render() {
    return (
      <>
        <div ref={this.contentRef} className='contents'>
          {this.props.present ? this.props.children : null}
        </div>
        <div
          ref={this.snapshotRef}
          aria-hidden
          inert
          className={this.props.present ? 'hidden' : 'contents'}
        />
      </>
    )
  }
}

export function ResumeFieldExitSnapshot({ children }: { children: ReactNode }) {
  const present = useIsPresent()

  return <FieldContent present={present}>{children}</FieldContent>
}
