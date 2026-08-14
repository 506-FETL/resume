# 简历评论 Bootstrap 性能验证基线

- 记录日期：2026-08-14
- 函数：`resume-comments` v9（2026-08-14 05:03:19 UTC 为 ACTIVE）
- Supabase 项目：`bitxrpdtlohlnywgusfw`
- 数据库区域：`us-east-1`
- 自动 Edge 区域：`ap-northeast-2`（首尔）

## 优化前同机告警

| 阶段 | 耗时 |
| --- | ---: |
| 端到端原始告警 | 6702 ms |
| Edge Function 内部 | 3573.7 ms |
| Auth | 1382.2 ms |
| access | 913.1 ms |
| 线程阶段 | 1273.2 ms |

该请求 `requestCount = 1`，线程数为 1。旧 `db` 是 `total - auth - access` 的残差，并非纯数据库执行时间；旧 `clientOverhead` 同样是残差，混合了浏览器、网关、调度与网络传输开销。

## 重复探测

| 探测 | 已确认结果 |
| --- | --- |
| OPTIONS | 匿名 POST 前重复触发预检；响应未提供 `Access-Control-Max-Age`，浏览器不能复用预检。 |
| 匿名 POST | 每个逻辑 bootstrap 的 `requestCount = 1`，未发现客户端重复 bootstrap；告警样本为 1 个线程。 |

自动路由的 Edge 位于 `ap-northeast-2`，而 Auth/PostgREST 与主数据库位于 `us-east-1`；后续基准将以相同身份和访问上下文分别测量 `auto` 与 `us-east-1`。

本文件仅记录已确认的优化前基线；优化后结果、身份矩阵与 SQL 查询计划在后续部署验证中追加。
