import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useCreateTemplateResume } from '@/hooks/use-create-template-resume'
import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'
import useResumeListStore from '@/pages/resume/store'
import { useResumeTemplateStore } from '@/store/resume-template'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import { catalogTemplateRef } from '../utils.ts'

export function useTemplateCreation(item: TemplateCatalogItem) {
  const creation = useCreateTemplateResume()

  const definition = useResumeTemplateStore(
    (state) => state.definitions[templateKey(catalogTemplateRef(item))],
  )

  const examples = useResumeTemplateStore((state) => state.examples)

  const isExampleReady = (example: ExampleRef) =>
    creation.retrying ||
    (definition?.status === 'ready' &&
      examples[exampleKey(example)]?.status === 'ready')

  const authStatus = useUserStore((state) => state.authStatus)

  const create = (example: ExampleRef) => {
    const currentId = useCurrentResumeStore.getState().resumeId
    const list = useResumeListStore.getState()

    // 延续当前本地简历上下文；已加载列表时沿用列表模式，直达页面才使用已有认证规则。
    const online =
      currentId && isOfflineResumeId(currentId)
        ? false
        : list.loading
          ? Boolean(useUserStore.getState().currentUser)
          : list.isOnline

    return creation.createResume({
      template: catalogTemplateRef(item),
      example,
      mode: online ? 'cloud' : 'local',
      displayName: '我的简历',
      description: '',
    })
  }

  return {
    ...creation,
    create,
    isExampleReady,
    disabled: authStatus === 'unknown' || creation.loading,
  }
}
