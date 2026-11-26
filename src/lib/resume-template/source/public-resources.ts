import { createTemplateCache } from './cache'
import { createResourceLoader } from './resource-loader'
import { createTemplateTransport } from './transport'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const cache = createTemplateCache(projectUrl)

export const publicTemplateResources = {
  cache,
  loader: createResourceLoader({ cache }),
  transport: createTemplateTransport(
    projectUrl,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
}
