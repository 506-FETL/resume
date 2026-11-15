BEGIN;

CREATE TABLE public.ai_context_checkpoints (
  conversation_id uuid PRIMARY KEY REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boundary_message_id uuid NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  boundary_created_at timestamptz NOT NULL,
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 24000),
  source_fingerprint text NOT NULL,
  estimated_tokens integer NOT NULL CHECK (estimated_tokens >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_context_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_context_checkpoints FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_context_checkpoints TO authenticated;
CREATE POLICY context_owner ON public.ai_context_checkpoints FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = conversation_id AND c.user_id = (SELECT auth.uid())
  ) AND EXISTS (
    SELECT 1 FROM public.ai_messages m
    WHERE m.id = boundary_message_id AND m.conversation_id = ai_context_checkpoints.conversation_id
      AND m.user_id = (SELECT auth.uid()) AND m.created_at = boundary_created_at
  )
);

CREATE FUNCTION public.invalidate_ai_context_checkpoint() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.ai_context_checkpoints
  WHERE conversation_id = OLD.conversation_id
    AND (boundary_created_at, boundary_message_id) >= (OLD.created_at, OLD.id);
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.invalidate_ai_context_checkpoint() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invalidate_ai_context_checkpoint() TO authenticated;
CREATE TRIGGER invalidate_ai_context_after_message_change
AFTER UPDATE OF parts OR DELETE ON public.ai_messages
FOR EACH ROW EXECUTE FUNCTION public.invalidate_ai_context_checkpoint();

CREATE OR REPLACE FUNCTION public.ai_message_visible_text(message_parts jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path = '' AS $$
SELECT COALESCE(pg_catalog.string_agg(
  CASE part.item ->> 'type'
    WHEN 'text' THEN part.item ->> 'text'
    WHEN 'reference' THEN part.item ->> 'label'
    WHEN 'skill-reference' THEN part.item ->> 'displayName'
  END, E'\n' ORDER BY part.ordinality), '')
FROM pg_catalog.jsonb_array_elements(message_parts) WITH ORDINALITY AS part(item, ordinality)
WHERE part.item ->> 'type' IN ('text', 'reference', 'skill-reference');
$$;
REINDEX INDEX public.idx_ai_messages_visible_text_trgm;

COMMIT;
