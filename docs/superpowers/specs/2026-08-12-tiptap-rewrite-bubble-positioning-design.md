# TipTap 划词改写气泡定位优化设计

## 背景

简历富文本编辑器通过 `AiRewriteBubble` 注册 TipTap `BubbleMenuPlugin`。用户划词后，
菜单应优先出现在选区上方，但当前实现会出现以下问题：

- 菜单向右展开并超出编辑器可视宽度。
- 菜单垂直位置贴近或覆盖选区。
- 编辑器内部滚动后，菜单位置不能及时同步。
- 多行选区、靠近顶部和窄编辑器等边界场景缺少明确策略。

## 根因

### 空宿主参与首次定位

`BubbleMenuPlugin.show()` 会先调用 `onShow`，随后立即调用 `updatePosition()`。
当前 `onShow` 只更新 React 的 `bubbleVisible` 状态，菜单按钮要到后续 React commit
才会挂载。Floating UI 首次定位时测量到的是空宿主，宽高接近零；完整工具条稍后出现，
但没有再次触发 `updatePosition`，因此会从错误锚点向右、向下展开。

### 宿主位于裁剪容器

虽然宿主创建时被加入 `document.body`，TipTap 显示菜单时仍会把它挂到
`editor.view.dom.parentElement`。该节点位于：

```text
.simple-editor-wrapper  overflow: hidden
└── .simple-editor-content  overflow: auto
```

菜单因此受到编辑器内部裁剪和滚动坐标系影响。当前 `onHide` 还会主动把宿主放回编辑器
父节点，进一步固化了该问题。

### 缺少边界和宽度策略

TipTap 默认把浮层宽度设为 `max-content`。当前五个动作保持单行且未启用 `size`，
完整菜单可能宽于编辑器。默认虚拟参考元素只暴露一个合并矩形，也无法准确描述多行文本
选区。插件仅监听窗口滚动，没有监听 `.simple-editor-content` 的内部滚动和容器尺寸变化。

## 目标

1. 菜单优先位于第一条可见选中文本的上方，与选区保持 `12px` 间距。
2. 上方垂直空间不足时，允许回退到选区下方。
3. 菜单始终限制在当前编辑器可视宽度内，左右保留 `8px` 安全距离。
4. 完整菜单横向放不下时，切换为省略号气泡按钮。
5. 省略号按钮使用 shadcn `Button`，动作列表使用 shadcn `DropdownMenu`。
6. 编辑器内部滚动、窗口滚动、缩放和容器 resize 时实时重算位置。
7. 支持单行、多行、反向选择、部分滚出和完全滚出等选区边界。
8. 不改变现有 AI 改写请求、候选状态机和写回逻辑。

## 非目标

- 不重构 AI 改写 LLM 请求和候选面板。
- 不替换 TipTap `BubbleMenuPlugin`。
- 不修改简历表单或协作数据流。
- 不为定位功能增加新的运行时依赖。

## 定位架构

### 浮层宿主

BubbleMenu 宿主通过 `appendTo: () => document.body` 固定挂载到 `body`，Floating UI
使用 `strategy: 'fixed'`。宿主不再受编辑器的 `overflow`、定位上下文或滚动裁剪影响。

退出动画期间如需重新连接宿主，只允许重新加入 `document.body`，禁止放回编辑器父节点。

### 编辑器边界

每个 `AiRewriteBubble` 从所属 editor 查找自己的 `.simple-editor-content`：

```text
editor.view.dom.closest('.simple-editor-content')
```

找不到时回退到 `editor.view.dom.parentElement`。该元素同时承担：

- Floating UI 的 `flip`、`shift`、`size` 和 `hide` 边界。
- 插件的 `scrollTarget`。
- 横向紧凑模式的可用宽度来源。

多个富文本编辑器各自计算边界，不共享 DOM 状态。

### 选区虚拟元素

新增选区几何 helper，根据 TipTap selection 创建 DOM `Range`，读取
`Range.getClientRects()`：

1. 过滤宽高为零的矩形。
2. 过滤与编辑器可视矩形完全不相交的行。
3. 对部分相交矩形裁剪到编辑器可视范围。
4. `getClientRects()` 返回全部可见文本行。
5. `getBoundingClientRect()` 返回可见文本行的合并矩形。
6. 没有可见矩形但原始 Range 仍存在时，返回原始行矩形交给 `hide` middleware 判定，
   避免插件因 virtual element 为 `null` 而保留旧坐标。
7. Range 本身无有效矩形时才返回 `null`。

Floating UI 启用 `inline` middleware。`top` 定位由第一条可见文本行决定；
回退到 `bottom` 时使用最后一条可见文本行。

### Floating UI 配置

```text
strategy: fixed
placement: top
offset: 12
flip: 仅允许 bottom 回退，boundary=editor，padding=8
shift: boundary=editor，padding=8，允许横向修正
size: boundary=editor，padding=8
hide: selection 完全离开 editor 时隐藏
inline: 使用真实文本行矩形
scrollTarget: .simple-editor-content
```

窗口 resize 继续由 TipTap 处理。额外为编辑器边界增加 `ResizeObserver`，尺寸变化时通过
插件 meta `updatePosition` 触发重算。

## 首次显示与动画

禁止 Floating UI 对空宿主完成最终定位。实现必须满足以下二选一条件：

- 菜单 DOM 在 TipTap `show()` 前已存在于宿主中；或
- 菜单 commit 后立即派发 `updatePosition`，在重算完成前保持宿主不可见。

完整/紧凑模式切换、字体尺寸变化和动作菜单尺寸变化后同样必须派发
`updatePosition`。入场动画只能在最终坐标确定后开始，不能影响 Floating UI 的布局测量。

## 横向紧凑模式

### 判定

完整工具条使用真实 DOM 测量固有宽度。可用宽度为：

```text
editor visible width - 2 × 8px
```

仅当完整工具条固有宽度大于可用宽度时启用紧凑模式。判定不依赖固定媒体查询；
编辑器变宽后自动恢复完整模式。

若编辑器窄到连省略号按钮和安全间距都无法容纳，则暂时隐藏 BubbleMenu。

### 紧凑触发器

紧凑模式渲染：

```text
Button
- variant: outline
- size: icon-sm
- icon: Ellipsis
- aria-label: 更多 AI 改写操作
```

图标使用 `data-icon`，不手动覆盖尺寸和颜色。

### 下拉动作

使用已有 shadcn `DropdownMenu`：

- `modal={false}`，避免临时菜单错误隐藏编辑器上下文。
- `DropdownMenuTrigger asChild` 包裹省略号按钮。
- 五个动作全部位于 `DropdownMenuGroup`。
- `DropdownMenuItem` 展示动作图标、名称和说明。
- 下拉菜单自身使用 Radix 碰撞检测，不手写屏幕边缘定位。

选择动作时先读取并保存 TipTap selection，再关闭下拉菜单并进入现有 AI 改写流程。
鼠标和键盘触发都必须只执行一次。

## 组件边界

### `ai-rewrite-bubble.tsx`

- 创建和销毁 BubbleMenu 宿主。
- 解析当前编辑器边界。
- 注册 TipTap 插件和 Floating UI 配置。
- 监听边界 resize 并触发位置更新。
- 保持现有 selection 保存、请求和写回职责。

### `components/bubble-menu.tsx`

- 根据 `compact` 渲染完整工具条或省略号菜单。
- 管理 shadcn DropdownMenu 的局部 open 状态。
- 对外只暴露 `onAction` 和尺寸测量回调。

### 定位工具

新增纯函数或低耦合 helper，负责：

- 矩形相交与裁剪。
- 可见选区矩形合并。
- 完整/紧凑模式判定。

DOM Range 创建与 TipTap editor 访问留在适配层，几何规则保持可单独测试。

## 边界行为

| 场景 | 行为 |
| --- | --- |
| 普通单行选区 | 菜单居中显示在选区上方 |
| 靠近编辑器左/右边缘 | 横向 shift，保持 `8px` 内边距 |
| 上方空间不足 | 翻转到选区下方 |
| 上下都紧张 | 选择可用空间更大的一侧并保持边界内 |
| 多行选区 | 上方锚定第一条可见行，下方回退锚定最后一条可见行 |
| 选区部分滚出 | 使用仍可见的文本行定位 |
| 选区完全滚出 | 隐藏菜单 |
| 完整菜单横向放不下 | 切换省略号按钮和 shadcn DropdownMenu |
| 编辑器 resize | 重新判定模式并重算位置 |
| 内部滚动 | 跟随选区更新；离开可视区后隐藏 |
| 多个编辑器 | 每个菜单只受所属编辑器边界约束 |

## 测试策略

### 自动化测试

使用 Node 内置 test runner 对几何 helper 先写失败测试，再实现：

- 矩形相交和裁剪。
- 多行可见矩形合并。
- 完整宽度等于、略小于、略大于可用宽度时的模式判定。
- 极窄编辑器隐藏判定。

DOM/TipTap 适配通过可控 DOM fixture 或浏览器回归验证，不为测试引入新的依赖。

### 静态验证

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec eslint src/components/ai-rewrite
pnpm build
git diff --check
```

### 浏览器回归

- 桌面常规宽度：完整工具条在选区上方。
- 桌面窄侧栏：左右不越界，必要时切换紧凑模式。
- 390px：省略号按钮和 DropdownMenu 可用。
- 编辑器顶部/底部：验证 top 优先和 bottom 回退。
- 单行/多行/反向选区。
- 编辑器内部滚动和容器 resize。
- 鼠标、键盘选择动作各执行一次。
- DropdownMenu 打开/关闭后 selection 仍可用于改写。

## 验收标准

1. 截图中的向右溢出和覆盖选区问题不再出现。
2. 完整菜单任何时候都不超出所属编辑器可视宽度。
3. 横向放不下时稳定切换为省略号菜单，不出现一帧闪烁或裁剪。
4. 选区和编辑器滚动/resize 后，菜单坐标在下一帧内更新。
5. 完全不可见的选区不会保留悬空气泡。
6. 现有五种 AI 改写动作、候选弹窗和写回行为保持不变。
