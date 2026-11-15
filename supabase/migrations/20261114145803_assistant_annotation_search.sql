BEGIN;

CREATE OR REPLACE FUNCTION public.ai_message_visible_text(message_parts jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path = '' AS $$
SELECT COALESCE(pg_catalog.string_agg(
  CASE part.item ->> 'type'
    WHEN 'text' THEN part.item ->> 'text'
    WHEN 'reference' THEN
      COALESCE(part.item ->> 'label', '') ||
      CASE WHEN part.item ->> 'kind' = 'annotation' THEN
        E'\n' || COALESCE((
          SELECT pg_catalog.string_agg(anchor.item ->> 'exactQuote', E'\n' ORDER BY anchor.ordinality)
          FROM pg_catalog.jsonb_array_elements(
            CASE WHEN pg_catalog.jsonb_typeof(part.item -> 'anchors') = 'array'
              THEN part.item -> 'anchors' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS anchor(item, ordinality)
        ), '')
      ELSE '' END
    WHEN 'skill-reference' THEN part.item ->> 'displayName'
  END, E'\n' ORDER BY part.ordinality), '')
FROM pg_catalog.jsonb_array_elements(message_parts) WITH ORDINALITY AS part(item, ordinality)
WHERE part.item ->> 'type' IN ('text', 'reference', 'skill-reference');
$$;
REINDEX INDEX public.idx_ai_messages_visible_text_trgm;

COMMIT;
