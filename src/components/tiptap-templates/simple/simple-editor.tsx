'use client'

import type { Editor } from '@tiptap/react'
import type { RewriteFieldContext } from '@/components/ai-rewrite'
import type { CollabExtensionConfig } from '@/lib/collaboration/richtext/collab-extensions'
import type { DebouncedMirror } from '@/lib/collaboration/richtext/mirror-debounce'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import * as React from 'react'
import { AiRewriteBubble } from '@/components/ai-rewrite'

// --- Icons ---
import { ArrowLeftIcon } from '@/components/tiptap-icons/arrow-left-icon'
import { HighlighterIcon } from '@/components/tiptap-icons/highlighter-icon'
import { LinkIcon } from '@/components/tiptap-icons/link-icon'

// --- Components ---
// --- UI Primitives ---
import { Button } from '@/components/tiptap-ui-primitive/button'
import { Spacer } from '@/components/tiptap-ui-primitive/spacer'
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/components/tiptap-ui-primitive/toolbar'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'

import {
  ColorHighlightPopover,
  ColorHighlightPopoverButton,
  ColorHighlightPopoverContent,
} from '@/components/tiptap-ui/color-highlight-popover'
// --- Tiptap UI ---
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ImageUploadButton } from '@/components/tiptap-ui/image-upload-button'
import {
  LinkButton,
  LinkContent,
  LinkPopover,
} from '@/components/tiptap-ui/link-popover'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button'
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button'
// --- Hooks ---
import { useIsMobile } from '@/hooks/use-mobile'

// --- Collab rich-text ---
import { buildEditorExtensions } from '@/lib/collaboration/richtext/collab-extensions'
import { createDebouncedMirror } from '@/lib/collaboration/richtext/mirror-debounce'

// --- Lib ---
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss'
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'

import '@/components/tiptap-node/list-node/list-node.scss'

import '@/components/tiptap-node/image-node/image-node.scss'

import '@/components/tiptap-node/heading-node/heading-node.scss'

import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'
// --- Styles ---
import '@/components/tiptap-templates/simple/simple-editor.scss'
import { toast } from 'sonner'

function MainToolbarContent({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={true} />
        <ListDropdownMenu
          types={['bulletList', 'orderedList', 'taskList']}
          portal={true}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile
          ? (
              <ColorHighlightPopover />
            )
          : (
              <ColorHighlightPopoverButton onClick={onHighlighterClick} />
            )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

    </>
  )
}

function MobileToolbarContent({
  type,
  onBack,
}: {
  type: 'highlighter' | 'link'
  onBack: () => void
}) {
  return (
    <>
      <ToolbarGroup>
        <Button data-style="ghost" onClick={onBack}>
          <ArrowLeftIcon className="tiptap-button-icon" />
          {type === 'highlighter'
            ? (
                <HighlighterIcon className="tiptap-button-icon" />
              )
            : (
                <LinkIcon className="tiptap-button-icon" />
              )}
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {type === 'highlighter'
        ? (
            <ColorHighlightPopoverContent />
          )
        : (
            <LinkContent />
          )}
    </>
  )
}



interface SimpleEditorProps {
  content?: string
  onChange?: (editor: Editor) => void
  fieldContext?: RewriteFieldContext
  collab?: CollabExtensionConfig
}

export function SimpleEditor({
  content = '',
  onChange = () => {},
  fieldContext,
  collab,
}: SimpleEditorProps) {
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = React.useState<
    'main' | 'highlighter' | 'link'
  >('main')
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const isCollab = Boolean(collab)

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        'autocomplete': 'off',
        'autocorrect': 'off',
        'autocapitalize': 'off',
        'aria-label': 'Main content area, start typing to enter text.',
        'class': 'simple-editor',
      },
    },
    extensions: buildEditorExtensions({
      collab,
      onImageError: message => toast.error(`上传图片失败: ${message}`),
    }),
    // 协作模式下 Yjs 是内容真源，不能传初始 content（否则每个 peer 都注入导致重复）
    ...(isCollab ? {} : { content }),
    // 模式切换（standalone <-> collaborative）或 fragment 变化时重建编辑器实例，
    // 因 useEditor 仅在创建时读取 extensions
  }, [isCollab, collab?.fragment])

  // 使用 ref 存储 onChange 回调，避免 useEffect 依赖变化导致重复注册
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  // 跟踪是否由外部 setContent 触发的更新，避免循环
  const isSettingContent = React.useRef(false)

  // 协作模式：把 onUpdate 产出的 HTML 去抖镜像给父组件（落 Automerge 供 preview/PDF/历史）。
  // 卸载时 flush，避免丢失最后 <300ms 的编辑。
  const mirrorRef = React.useRef<DebouncedMirror<Editor> | null>(null)
  React.useEffect(() => {
    if (!isCollab) {
      mirrorRef.current = null
      return
    }
    const mirror = createDebouncedMirror<Editor>((ed) => {
      onChangeRef.current(ed)
    }, 300)
    mirrorRef.current = mirror
    return () => {
      mirror.flush()
      mirrorRef.current = null
    }
  }, [isCollab])

  // 注册 onUpdate 事件处理
  React.useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      // 如果是 setContent 触发的更新，不通知父组件
      if (isSettingContent.current) {
        return
      }
      // 协作模式：去抖镜像；standalone：即时回调
      if (mirrorRef.current) {
        mirrorRef.current.run(editor)
      }
      else {
        onChangeRef.current(editor)
      }
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor])

  // 处理外部 content 变化（仅 standalone；协作模式 Yjs 是真源，忽略 content prop）
  const prevContentRef = React.useRef(content)
  React.useEffect(() => {
    if (!editor || isCollab) return

    // 只有当外部 content 真正变化时才设置
    // 比较 HTML 内容而不是引用
    const currentHtml = editor.getHTML()
    if (content !== prevContentRef.current && content !== currentHtml) {
      isSettingContent.current = true
      editor.commands.setContent(content)
      isSettingContent.current = false
    }
    prevContentRef.current = content
  }, [content, editor, isCollab])

  React.useEffect(() => {
    if (!isMobile && mobileView !== 'main') {
      setMobileView('main')
    }
  }, [isMobile, mobileView])

  // 协作模式：把最新的用户名 / 颜色推进 Yjs awareness。
  // CollaborationCaret 仅在插件初始化时写一次 `user`（options.user），而 useEditor 的依赖
  // 只有 [isCollab, fragment]，不含用户名——展示名往往在编辑器创建之后才异步解析完成
  // （如 participants[selfPeerId].metadata.userName 尚未就绪时回落为「协作者」）。
  // 若不在此显式同步，awareness 会一直保留创建时的陈旧值，远端光标标签便显示为空 / 占位。
  // 用 updateUser 命令在 user 变化时刷新，鼠标光标（实时重播）与编辑器光标即可保持一致。
  // 注意需带上 id（稳定人类身份），供远端按人去重光标。
  const collabUserName = collab?.user.name
  const collabUserColor = collab?.user.color
  const collabUserId = collab?.user.id
  React.useEffect(() => {
    if (!editor || !isCollab || collabUserName == null) {
      return
    }
    editor.commands.updateUser({ name: collabUserName, color: collabUserColor, id: collabUserId })
  }, [editor, isCollab, collabUserName, collabUserColor, collabUserId])

  const editorContextValue = React.useMemo(() => ({ editor }), [editor])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext value={editorContextValue}>
        <Toolbar ref={toolbarRef}>
          {mobileView === 'main'
            ? (
                <MainToolbarContent
                  onHighlighterClick={() => setMobileView('highlighter')}
                  onLinkClick={() => setMobileView('link')}
                  isMobile={isMobile}
                />
              )
            : (
                <MobileToolbarContent
                  type={mobileView === 'highlighter' ? 'highlighter' : 'link'}
                  onBack={() => setMobileView('main')}
                />
              )}
        </Toolbar>

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
        {editor && fieldContext && (
          <AiRewriteBubble editor={editor} fieldContext={fieldContext} />
        )}
      </EditorContext>
    </div>
  )
}
