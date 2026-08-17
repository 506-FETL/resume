-- 20260817000003_add_ai_conversation_resume_binding.sql
-- AI 会话绑定「当前查看/编辑的简历」，用于助手画布的简历预览按会话切换，
-- 而非跟随全局当前简历。列可为空（新会话或尚未打开任何简历时）。
-- 不加外键到 resume_config：简历删除后仅需预览回退，无需级联；RLS 仍为 owner-only。

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS resume_id uuid;

COMMENT ON COLUMN public.ai_conversations.resume_id IS
  '该会话当前绑定的简历 resume_id（助手画布预览用，可为空）';
