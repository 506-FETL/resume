import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ExperienceInput } from './input.ts'
import {
  loadExperienceMetadata,
  listExperienceSources,
  readExperienceOperation,
} from './queries.ts'
import { saveExperienceSource } from './save.ts'
import { readExperienceSource } from './read.ts'
import {
  renameExperienceSource,
  deleteExperienceSource,
  deleteExperienceConversation,
} from './mutations.ts'
import { searchExperienceSources } from './search.ts'
import { handleExperienceRelations } from './relations.ts'

export async function handleExperienceInput(
  admin: SupabaseClient,
  owner: string,
  input: ExperienceInput,
  file: File | null,
): Promise<unknown | Response> {
  switch (input.action) {
    case 'metadata':
      return loadExperienceMetadata(admin, owner, input)
    case 'list':
      return listExperienceSources(admin, owner, input)
    case 'operation':
      return readExperienceOperation(admin, owner, input)
    case 'save':
      return saveExperienceSource(admin, owner, input, file)
    case 'text':
    case 'read':
    case 'download':
      return readExperienceSource(admin, owner, input)
    case 'rename':
      return renameExperienceSource(admin, owner, input)
    case 'delete':
      return deleteExperienceSource(admin, owner, input)
    case 'delete-conversation':
      return deleteExperienceConversation(admin, owner, input)
    case 'search':
      return searchExperienceSources(admin, owner, input)
    case 'relations':
    case 'set-relations':
      return handleExperienceRelations(admin, owner, input)
  }
}
