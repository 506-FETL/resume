-- 只合并浏览器到数据库的往返。每条同步消息仍按原顺序校验租约并投递至目标私有收件箱。
CREATE FUNCTION public.send_automerge_sync_batch(p_inbox_id uuid, p_payloads jsonb[])
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF p_payloads IS NULL OR cardinality(p_payloads) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'invalid_message_batch' USING ERRCODE = '22023';
  END IF;

  FOREACH v_payload IN ARRAY p_payloads LOOP
    PERFORM public.send_automerge_message(p_inbox_id, 'automerge-sync', v_payload);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.send_automerge_sync_batch(uuid, jsonb[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_automerge_sync_batch(uuid, jsonb[]) TO authenticated;
