import { deferDialog } from '@/components/deferred-dialog'
import useTrackerStore from '../../store'
import { useShallow } from 'zustand/react/shallow'

const Job = deferDialog(() => import('../drawer'), '职位详情')
const Add = deferDialog(() => import('../drawer/add-job'), '新增职位')

const Submission = deferDialog(
  () => import('../drawer/submission-dialog'),
  '记录投递',
)

const Reopen = deferDialog(() => import('../drawer/reopen-process'), '恢复流程')

export function TrackerDialogs() {
  const [job, add, submission, reopen] = useTrackerStore(
    useShallow((state) => [
      state.drawerOpen,
      state.addDrawerOpen,
      Boolean(state.submissionQueue.length),
      Boolean(state.reopenQueue.length),
    ]),
  )

  return (
    <>
      <Job
        open={job}
        onClose={() => useTrackerStore.getState().closeJobDrawer()}
      >
        {(Content, opener) => <Content opener={opener} />}
      </Job>
      <Add
        open={add}
        onClose={() => useTrackerStore.getState().closeAddDrawer()}
      >
        {(Content, opener) => <Content opener={opener} />}
      </Add>
      <Submission
        open={submission}
        onClose={() => useTrackerStore.getState().finishSubmission()}
      >
        {(Content, opener) => <Content opener={opener} />}
      </Submission>
      <Reopen
        open={reopen}
        onClose={() => useTrackerStore.getState().finishReopen()}
      >
        {(Content, opener) => <Content opener={opener} />}
      </Reopen>
    </>
  )
}
