我将实现支持在线和本地简历的 ATS 分析流程。

### 1. 数据库与状态管理更新

* **更新** **`src/lib/supabase/resume/ats.ts`**: 添加 `createAtsConfig` 函数以处理新 ATS 记录的创建。

* **更新** **`src/pages/optimize/store.ts`**:

  * 在 store 中添加 `selectedResumeId` 和 `selectedResumeType` 状态，用于全局跟踪用户的选择。

  * 添加 `setSelectedResume` 动作。

### 2. 数据获取工具

* **更新** **`src/pages/optimize/utils.ts`**:

  * 实现 `fetchResumeDataForAnalysis(id, isOffline)` 辅助函数。

  * 该函数将处理：

    * 从 Supabase (在线) 或 IndexedDB (离线) 获取数据。

    * **关键点**: 将数据库字段 (snake\_case) 映射为 LLM 所需的格式 (camelCase)，确保 `resume_config` 格式正确。可以具体查看resume是怎么实现的，参照他的方法。

### 3. 组件重构

* **重构** **`ResumeManager`** **(`src/pages/optimize/components/header/resume-manager/index.tsx`)**:

  * 连接到更新后的 `useAtsStore` 以持久化选择状态。

  * 移除冗余的本地状态。

* **重构** **`Header`** **(`src/pages/optimize/components/header/index.tsx`)**:

  * **简历选择**: 使用全局选择状态。

  * **分析流程**:

    1. **获取**: 使用新工具函数检索简历数据。
    2. **分析**: 将真实简历数据发送给 `runAtsStructured` (替换模拟的 `data.ts`)。
    3. **持久化**:

       * 如果是首次分析：在 Supabase 中创建新的 ATS 记录。

       * 如果是重新分析：更新现有的 ATS 记录。
    4. **展示**: 实时更新 UI 展示“思考中”过程和最终报告。

### 4. 实现细节

* **代码整洁**: 逻辑将分离到 `utils` 和 `store` 中，保持组件整洁。

* **用户体验**: “思维链” UI 将反映真实的分析过程 (思考中 -> 生成中 -> 完成)。

* **离线支持**: 本地简历将直接从本地存储读取以进行分析。

我将从更新 Supabase 服务函数开始，然后是 store，最后是 UI 组件。
