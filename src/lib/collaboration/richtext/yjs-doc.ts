import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

/**
 * 会话级 Yjs 文档与 awareness 容器。
 *
 * 一个协作会话对应一个 `Y.Doc`；每个富文本字段是其下一个命名 `Y.XmlFragment`
 * （键由 `buildFragmentKey` 生成）。`awareness` 承载本地/远端光标与用户信息，
 * 供 `CollaborationCaret` 渲染。会话结束时 `destroy()` 释放资源。
 */
export interface RichTextCollabUser {
  name: string
  color: string
}

export class RichTextCollabSession {
  readonly doc: Y.Doc
  readonly awareness: Awareness

  constructor() {
    this.doc = new Y.Doc()
    this.awareness = new Awareness(this.doc)
  }

  /** 取（惰性创建）某字段对应的 XmlFragment。对同一 key 幂等返回同一实例。 */
  getFieldFragment(key: string): Y.XmlFragment {
    return this.doc.getXmlFragment(key)
  }

  /** 设置本地用户信息（CollaborationCaret 从 awareness 的 `user` 字段读取）。 */
  setLocalUser(user: RichTextCollabUser): void {
    this.awareness.setLocalStateField('user', user)
  }

  destroy(): void {
    this.awareness.destroy()
    this.doc.destroy()
  }
}
