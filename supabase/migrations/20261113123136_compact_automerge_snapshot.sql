CREATE FUNCTION public.get_automerge_snapshot(
  p_resume_id uuid,
  p_user_id uuid
)
RETURNS TABLE (document_data text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    -- 旧写入将 Base64 文本存进 bytea；原生二进制则保留 Automerge 魔数。
    WHEN substring(document.document_data FROM 1 FOR 4) = '\x856f4a83'::bytea
      THEN encode(document.document_data, 'base64')
    ELSE convert_from(document.document_data, 'UTF8')
  END
  FROM public.automerge_documents AS document
  WHERE document.resume_id = p_resume_id
    AND document.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_automerge_snapshot(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_automerge_snapshot(uuid, uuid)
  TO authenticated;
