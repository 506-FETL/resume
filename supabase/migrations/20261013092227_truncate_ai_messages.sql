-- 截断排序与 listMessages 的 (created_at, id) 一致；整段删除在一个事务中完成。
CREATE OR REPLACE FUNCTION public.truncate_ai_messages(
  p_conversation_id uuid,
  p_message_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_created_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authentication changed' USING ERRCODE = '42501';
  END IF;

  -- 锁住当前用户自己的会话，串行化同一会话的截断操作。
  PERFORM 1 FROM public.ai_conversations
  WHERE id = p_conversation_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '42501';
  END IF;

  SELECT created_at INTO v_created_at
  FROM public.ai_messages
  WHERE id = p_message_id AND conversation_id = p_conversation_id
    AND user_id = auth.uid() AND role = 'user'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User message not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.ai_messages
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
    AND (created_at, id) >= (v_created_at, p_message_id);
END;
$$;

REVOKE ALL ON FUNCTION public.truncate_ai_messages(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.truncate_ai_messages(uuid, uuid, uuid) TO authenticated;
