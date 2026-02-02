'use client'

import { Highlight } from '@tiptap/extension-highlight'
import type { Editor } from '@tiptap/react'

import { Image } from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { Selection } from '@tiptap/extensions'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
// --- Tiptap Core Extensions ---
import { StarterKit } from '@tiptap/starter-kit'
import * as React from 'react'

// --- Icons ---
import { ArrowLeftIcon } from '@/components/tiptap-icons/arrow-left-icon'
import { HighlighterIcon } from '@/components/tiptap-icons/highlighter-icon'
import { LinkIcon } from '@/components/tiptap-icons/link-icon'

import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
// --- Tiptap Node ---
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
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

import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils'

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



export function SimpleEditor({
  content = '',
  onChange = () => {},
}: { content?: string, onChange?: (editor: Editor) => void }) {
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = React.useState<
    'main' | 'highlighter' | 'link'
  >('main')
  const toolbarRef = React.useRef<HTMLDivElement>(null)

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
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: error => console.error('Upload failed:', error),
      }),
    ],
    content,
  })

  // 使用 ref 存储 onChange 回调，避免 useEffect 依赖变化导致重复注册
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  // 跟踪是否由外部 setContent 触发的更新，避免循环
  const isSettingContent = React.useRef(false)

  // 注册 onUpdate 事件处理
  React.useEffect(() => {
    if (!editor) return
    
    const handleUpdate = () => {
      // 如果是 setContent 触发的更新，不通知父组件
      if (isSettingContent.current) {
        return
      }
      onChangeRef.current(editor)
    }
    
    editor.on('update', handleUpdate)
    
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor])

  // 处理外部 content 变化
  const prevContentRef = React.useRef(content)
  React.useEffect(() => {
    if (!editor) return
    
    // 只有当外部 content 真正变化时才设置
    // 比较 HTML 内容而不是引用
    const currentHtml = editor.getHTML()
    if (content !== prevContentRef.current && content !== currentHtml) {
      isSettingContent.current = true
      editor.commands.setContent(content)
      isSettingContent.current = false
    }
    prevContentRef.current = content
    
  }, [content, editor])

  React.useEffect(() => {
    if (!isMobile && mobileView !== 'main') {
      setMobileView('main')
    }
  }, [isMobile, mobileView])

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
      </EditorContext>
    </div>
  )
}
