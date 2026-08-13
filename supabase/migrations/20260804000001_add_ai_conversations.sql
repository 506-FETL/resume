-- 20260804000001_add_ai_conversations.sql
-- AI 助手：会话表。owner-only RLS，按 updated_at 排序用于会话列表。

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '新对话',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON public.ai_conversations USING btree (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conversations_insert_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conversations_update_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_conversations_delete_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);
