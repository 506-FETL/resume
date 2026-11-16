import type { PersistenceGet, PersistenceSet } from './types'
import { createPersistenceRuntime } from './runtime'
import { createWorkflowDrafts } from './workflow-drafts'
import { createFieldWrites } from './field-writes'
import { createSubmissionActions } from './submission-actions'
import { createWorkflowActions } from './workflow-actions'
import { createJobLifecycle } from './job-lifecycle'

export type {
  WorkflowSaveStatus,
  WorkflowSaveState,
  JobFieldsPatch,
} from './types'

export { SubmissionRefreshError } from './errors'

// 页面级队列不依赖 Drawer 挂载。整行 API 响应只接纳本次提交的字段。
export function createTrackerPersistence(
  get: PersistenceGet,
  set: PersistenceSet,
) {
  const core = createPersistenceRuntime(get, set)
  const drafts = createWorkflowDrafts(core)
  const writes = createFieldWrites(core, drafts)

  return {
    ...createSubmissionActions(core, drafts, writes),
    ...createWorkflowActions(core, drafts, writes),
    ...createJobLifecycle(core, drafts),
  }
}
