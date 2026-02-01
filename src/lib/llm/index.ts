import type { ResumeSchema } from '../schema'
import client from './client'
import prompt from './prompt'

export async function runAtsStructured(
  resumeConfig: ResumeSchema,
  onUpdate?: (data: { content?: string, reasoning?: string }) => void,
) {
  const promptText = prompt.replace('<<<RESUME_JSON>>>', JSON.stringify(resumeConfig, null, 2))
  const stream = await client.chat.completions.create({
    model: 'deepseek-reasoner',
    messages: [
      {
        role: 'system',
        content: `你是一个 ATS 简历评估引擎。你将收到一份用户上传的“简历 JSON”（字段固定，包含基本信息、求职意向、教育/工作/项目等）。你的任务是：仅根据该简历 JSON 的内容，生成一份「AtsEvaluationResult」评估结果 JSON。`,
      },
      { role: 'user', content: promptText },
    ],
    response_format: {
      type: 'json_object',
    },
    temperature: 0,
    stream: true,
  })

  let fullContent = ''
  let fullReasoning = ''

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as any
    const content = delta?.content || ''
    const reasoning = delta?.reasoning_content || ''

    if (content || reasoning) {
      if (content)
        fullContent += content
      if (reasoning)
        fullReasoning += reasoning

      onUpdate?.({
        content: fullContent,
        reasoning: fullReasoning,
      })
    }
  }

  return { content: fullContent, reasoning: fullReasoning }
}
