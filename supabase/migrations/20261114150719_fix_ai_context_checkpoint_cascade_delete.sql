BEGIN;

-- Auth 管理角色级联删除消息时没有检查点表权限；失效操作只允许由原消息触发。
CREATE OR REPLACE FUNCTION public.invalidate_ai_context_checkpoint()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.ai_context_checkpoints
  WHERE user_id = OLD.user_id
    AND conversation_id = OLD.conversation_id
    AND (boundary_created_at, boundary_message_id) >= (OLD.created_at, OLD.id);

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.invalidate_ai_context_checkpoint()
FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;

COMMIT;
