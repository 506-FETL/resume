# 简历搜索临时验收

本目录验收完成后删除。正式代码没有测试开关；不读取真实账户、远端数据或正式 IndexedDB。

## Node 检查

```sh
node --experimental-vm-modules tests/workspace-controls/pagination/verify-filter-cache.mjs
node --experimental-vm-modules tests/resume-workflow/search/verify-search-store.mjs
node --experimental-vm-modules tests/resume-workflow/search/verify-search-sdk.mjs
node tests/resume-workflow/search/verify-auth-effect.mjs
pnpm exec tsc --project tests/workspace-controls/pagination/tsconfig.json --noEmit
```

分别为原 12 组分页/分类、10 组搜索、6 组真实 Supabase SDK 请求协议。VM 加载正式 TS 实现，store 仅替换用户和数据读取边界；SDK 使用真实客户端与正式摘要映射，仅替换 fetch 返回合成数据。

初始化另有 5 项直接提取正式 ResumePage 的 effect 与依赖表达式执行，未复制 effect 条件；真实 React 挂载再用下面的 `authInit=delayed` 入口验证。

## 真实页面与输入法

继续使用 5193 的分页服务器，启动命令见 `../../workspace-controls/pagination/README.md`。

`http://127.0.0.1:5193/tests/workspace-controls/pagination/index.html?search=1&controls=1`

- `示例`：23 条云端/本地混合记录，可检查 10/10/3 与筛选。
- `观察星云`：只有云端描述包含，原始排序位于第二页。
- `仅描述本地`：只有末页本地描述包含。
- `%_,'"\`：只有一条描述包含，全部字符按字面匹配。
- 完整访问未搜索的三页后再搜索，`[data-fixture-report]` 的 requests 应保持空；搜索清空/回词、缓存页往返也应无读取。
- 控制按钮“开始中文组合输入”派发真实 compositionstart/input，等待超过 250ms 后 query 与请求仍不变；“完成中文组合输入”派发 compositionend，完成后仅有一组目标查询；“完成后立即清空”在 30ms 后点击真实清空按钮，防抖旧词不得迟到。
- 加 `slowSearch=1&delay=1500` 可查看慢查询；加 `scenario=error&context=1` 检查 320×400 的完整页头上下文、失败、搜索和固定页脚。短屏只有非搜索页头区允许局部滚动。
- 加 `authInit=delayed` 时先保持身份未知 350ms，再初始化账户 A；report 的 authObservations 应记录 unknown-before-init 请求数为 0，首次列表仅一组读取。控制按钮“切到账户 B”“返回账户 A”用于检查真实页面 effect 的账户重载，request.owner 可区分两次身份；重复点击相同账户不应重新读取。

## 真实 IndexedDB

`http://127.0.0.1:5193/tests/workspace-controls/pagination/index.html?offline-index=1`

自动运行 6 组：v1、v2、完整 v3、缺索引的历史 v3、v5、只有一项搜索索引的 v5。Vite 仅替换正式 offline manager 的数据库名为随机 `resume-workflow-search-*`。测试检查两项索引、中文/英文/特殊字符、缺时间记录、搜索阶段记录读取为零、摘要按页读取、完整正文和额外存储表不变；完成后删除该测试数据库。页面 `[data-offline-report]` 给出实际结果；Node 检查不能代替这一项浏览器结果。
