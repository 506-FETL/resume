import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import useAssistantStore from '../store'

const handoffSchema = z.array(
  z.object({
    sourceId: z.string().uuid(),
    versionId: z.string().uuid(),
    name: z.string(),
  }),
)

export function useExperienceHandoff() {
  const location = useLocation()
  const navigate = useNavigate()

  const ready = useAssistantStore(
    (state) =>
      !state.initializing && !state.loadingMessages && !state.bootstrapError,
  )

  useEffect(() => {
    const state = location.state as Record<string, unknown> | null

    if (!ready || !state?.experienceReferences) return

    const parsed = handoffSchema.safeParse(state.experienceReferences)

    if (parsed.success)
      useAssistantStore.getState().addComposerReferences(
        parsed.data.map((reference) => ({
          type: 'reference',
          kind: 'experience',
          id: reference.sourceId,
          versionId: reference.versionId,
          label: reference.name,
        })),
      )

    const nextState = { ...state }

    delete nextState.experienceReferences
    navigate(location.pathname, { replace: true, state: nextState })
  }, [location, navigate, ready])
}
