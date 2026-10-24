import { create } from 'zustand'

interface ProfileFieldEditState {
  isEditing: boolean
  isSaving: boolean
}

interface ProfileStore {
  name: ProfileFieldEditState
  email: ProfileFieldEditState
  setNameEditing: (editing: boolean) => void
  setNameSaving: (saving: boolean) => void
  setEmailEditing: (editing: boolean) => void
  setEmailSaving: (saving: boolean) => void
  reset: () => void
}

const initialFieldState: ProfileFieldEditState = {
  isEditing: false,
  isSaving: false,
}

export const useProfileStore = create<ProfileStore>((set) => ({
  name: { ...initialFieldState },
  email: { ...initialFieldState },
  setNameEditing: (editing) =>
    set((state) => ({ name: { ...state.name, isEditing: editing } })),
  setNameSaving: (saving) =>
    set((state) => ({ name: { ...state.name, isSaving: saving } })),
  setEmailEditing: (editing) =>
    set((state) => ({ email: { ...state.email, isEditing: editing } })),
  setEmailSaving: (saving) =>
    set((state) => ({ email: { ...state.email, isSaving: saving } })),
  reset: () =>
    set({
      name: { ...initialFieldState },
      email: { ...initialFieldState },
    }),
}))
