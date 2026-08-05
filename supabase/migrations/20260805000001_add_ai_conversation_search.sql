-- AI 助手 S5：搜索会话标题与用户可见消息正文。
-- 仅提取 parts 中 type=text 的内容；不索引 reasoning、tool-call、image 或 system 消息。

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.ai_message_visible_text(message_parts jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.string_agg(part.item ->> 'text', E'\n' ORDER BY part.ordinality),
    ''
  )
  FROM pg_catalog.jsonb_array_elements(message_parts)
    WITH ORDINALITY AS part(item, ordinality)
  WHERE part.item ->> 'type' = 'text'
$$;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_title_trgm
  ON public.ai_conversations
  USING gin (title extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ai_messages_visible_text_trgm
  ON public.ai_messages
  USING gin (
    public.ai_message_visible_text(parts) extensions.gin_trgm_ops
  );

-- 先删除旧函数：若历史版本的返回签名不同，CREATE OR REPLACE 会因“无法更改返回类型”失败，
-- 导致仍保留报错的旧函数体。显式 DROP 确保可重复安全地重新应用本迁移。
DROP FUNCTION IF EXISTS public.search_ai_conversations(text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_ai_conversations(
  p_search_query text,
  p_result_limit integer DEFAULT 20,
  p_result_offset integer DEFAULT 0
)
RETURNS TABLE (
  conversation_id uuid,
  conversation_title text,
  message_id uuid,
  excerpt text,
  role text,
  matched_at timestamptz,
  conversation_updated_at timestamptz,
  match_type text,
  relevance real
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  normalized_query text := pg_catalog.left(pg_catalog.btrim(p_search_query), 200);
  escaped_query text;
  search_pattern text;
  safe_limit integer := LEAST(GREATEST(p_result_limit, 1), 50);
  safe_offset integer := GREATEST(p_result_offset, 0);
BEGIN
  IF
    auth.uid() IS NULL
    OR normalized_query IS NULL
    OR pg_catalog.length(normalized_query) < 2
  THEN
    RETURN;
  END IF;

  escaped_query := pg_catalog.replace(
    normalized_query,
    pg_catalog.chr(92),
    pg_catalog.chr(92) || pg_catalog.chr(92)
  );
  escaped_query := pg_catalog.replace(
    escaped_query,
    '%',
    pg_catalog.chr(92) || '%'
  );
  escaped_query := pg_catalog.replace(
    escaped_query,
    '_',
    pg_catalog.chr(92) || '_'
  );
  search_pattern := '%' || escaped_query || '%';

  RETURN QUERY
  WITH message_texts AS (
    SELECT
      message.id,
      message.conversation_id,
      message.role,
      message.created_at,
      public.ai_message_visible_text(message.parts) AS visible_text
    FROM public.ai_messages AS message
    WHERE message.user_id = auth.uid()
      AND message.role IN ('user', 'assistant')
  ),
  title_hits AS (
    SELECT
      conversation.id AS conversation_id,
      conversation.title AS conversation_title,
      NULL::uuid AS message_id,
      conversation.title AS excerpt,
      NULL::text AS role,
      conversation.updated_at AS matched_at,
      conversation.updated_at AS conversation_updated_at,
      'title'::text AS match_type,
      (
        2
        + CASE
            WHEN pg_catalog.lower(conversation.title) = pg_catalog.lower(normalized_query) THEN 1
            ELSE 0
          END
        + extensions.similarity(conversation.title, normalized_query)
      )::real AS relevance
    FROM public.ai_conversations AS conversation
    WHERE conversation.user_id = auth.uid()
      AND conversation.title ILIKE search_pattern ESCAPE pg_catalog.chr(92)
  ),
  message_hits AS (
    SELECT
      conversation.id AS conversation_id,
      conversation.title AS conversation_title,
      message_text.id AS message_id,
      pg_catalog.substr(
        message_text.visible_text,
        GREATEST(
          pg_catalog.strpos(
            pg_catalog.lower(message_text.visible_text),
            pg_catalog.lower(normalized_query)
          ) - 60,
          1
        ),
        180
      ) AS excerpt,
      message_text.role,
      message_text.created_at AS matched_at,
      conversation.updated_at AS conversation_updated_at,
      'message'::text AS match_type,
      (1 + extensions.similarity(message_text.visible_text, normalized_query))::real AS relevance
    FROM message_texts AS message_text
    JOIN public.ai_conversations AS conversation
      ON conversation.id = message_text.conversation_id
    WHERE conversation.user_id = auth.uid()
      AND message_text.visible_text ILIKE search_pattern ESCAPE pg_catalog.chr(92)
  ),
  combined AS (
    SELECT * FROM title_hits
    UNION ALL
    SELECT * FROM message_hits
  )
  SELECT combined.*
  FROM combined
  ORDER BY
    combined.relevance DESC,
    combined.matched_at DESC,
    combined.conversation_updated_at DESC
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ai_message_visible_text(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_message_visible_text(jsonb)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_ai_conversations(text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_ai_conversations(text, integer, integer)
  TO authenticated;

COMMIT;
