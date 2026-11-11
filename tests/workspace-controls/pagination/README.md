# 简历分页隔离验收

从仓库根目录运行 `pnpm exec vite --config tests/workspace-controls/pagination/vite.config.ts --host 127.0.0.1`。

入口：`http://127.0.0.1:5193/tests/workspace-controls/pagination/index.html`。

- 默认：23 条合成摘要，真实 library slice 负责 10 / 10 / 3 混合分页、过滤和缓存；后续页延迟 800ms。
- `?count=2&controls=1`：两份原始简历，用于验证全部 / 原始 / 岗位首次切换无读取、无 loading。清空观测记录后点击三个真实页签，再读取 `[data-fixture-report]`。
- `?delay=50`：快速请求；`?delay=1500`：慢请求。初次读取默认立即完成，可加 `slowInitial=1`。
- `?fail=2`：首次点击下一页失败一次，保留原页；再次点击可以成功，便于检查失败回焦。
- `?scenario=error&context=1`：初次加载后自动失败一次，保留旧列表，并叠加岗位上下文、任务、同步入口和错误栏。
- `?scenario=loading&controls=1`：第一页后保持第二页加载，使用“完成本次加载”释放。
- `?scenario=skeleton&controls=1`：保持首次骨架，使用“完成本次加载”释放。
- `?scenario=empty`：真实空列表。普通场景点击“岗位版本”也可验证筛选空态。
- `theme=dark`、`sidebar=0` 可与以上参数组合。系统减少动效仍沿用实际媒体偏好。
- `controls=1` 提供可点击验收设置；截图前点击“收起验收设置”。默认不显示测试控件。

只读 DOM 可读取 `[data-fixture-report]` 的文本获得请求和 store 状态变化；已访问页返回应无新增读取、无 `loading=true`。`data-resume-row`、`[aria-label='简历列表']`、`[aria-label='简历分页']` 可用于页面几何与焦点检查。

夹具使用真实 ResumePage、ResumeCard、DashboardShell 与分页 store。Vite 仅重写 library slice 的用户、云端摘要和离线索引读取边界。预览 acquire 保持闲置，不生成或伪造纸张正文；本夹具不用于验证预览内容。认证会话为合成对象，Supabase 项目改为 `.invalid`，实时订阅不启动；localStorage/sessionStorage 在内存，IndexedDB 禁止，外部 fetch/WebSocket 在发出前阻断。不要点击保存、生成、分享等与本轮无关的动作。

临时文件由主代理验收后删除；没有修改正式代码来添加测试开关。

真实分页 slice 的独立验证：`node --experimental-vm-modules tests/workspace-controls/pagination/verify-filter-cache.mjs`。脚本直接编译现有 slice 和错误处理器，仅替换读取边界，使用真实 Zustand store；覆盖等价筛选、完整混合数据、缺页、失败、在途返回、写后失效及账户切换。
