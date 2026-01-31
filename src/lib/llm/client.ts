import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: import.meta.env.VITE_LLM_KEY,
  dangerouslyAllowBrowser: true,
})

export default client
