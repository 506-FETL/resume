-- blockOrdinal 始终标记选区起始块。结束偏移可以位于同一 nodeKey 的后续块，
-- 但不能倒序或越过节点投影边界。
CREATE OR REPLACE FUNCTION public.is_valid_resume_comment_anchor(
  p_anchor jsonb,
  p_document jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce((
    p_anchor IS NOT NULL
    AND jsonb_typeof(p_anchor) = 'object'
    AND jsonb_typeof(p_anchor -> 'nodeKey') = 'string'
    AND btrim(p_anchor ->> 'nodeKey') <> ''
    AND jsonb_typeof(p_anchor -> 'exactQuote') = 'string'
    AND btrim(p_anchor ->> 'exactQuote') <> ''
    AND jsonb_typeof(p_anchor -> 'startGraphemeOffset') = 'number'
    AND jsonb_typeof(p_anchor -> 'endGraphemeOffset') = 'number'
    AND jsonb_typeof(p_anchor -> 'blockOrdinal') = 'number'
    AND (p_anchor ->> 'startGraphemeOffset')::integer >= 0
    AND (p_anchor ->> 'endGraphemeOffset')::integer
      > (p_anchor ->> 'startGraphemeOffset')::integer
    AND (p_anchor ->> 'blockOrdinal')::integer >= 0
    AND coalesce(p_anchor ->> 'createdAtContentHash', '') ~ '^[0-9a-f]{64}$'
    AND public.resume_comment_anchor_document_has_node(
      p_document,
      p_anchor ->> 'nodeKey'
    )
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_document -> 'nodes') AS node(value)
      CROSS JOIN LATERAL (
        SELECT
          (block.value ->> 'ordinal')::integer AS ordinal,
          (block.value ->> 'startGraphemeOffset')::integer AS start_offset,
          (block.value ->> 'endGraphemeOffset')::integer AS end_offset
        FROM jsonb_array_elements(node.value -> 'blocks') AS block(value)
        WHERE (block.value ->> 'ordinal')::integer
          = (p_anchor ->> 'blockOrdinal')::integer
        LIMIT 1
      ) AS start_block
      CROSS JOIN LATERAL (
        SELECT
          (block.value ->> 'ordinal')::integer AS ordinal,
          (block.value ->> 'startGraphemeOffset')::integer AS start_offset,
          (block.value ->> 'endGraphemeOffset')::integer AS end_offset
        FROM jsonb_array_elements(node.value -> 'blocks') AS block(value)
        WHERE (p_anchor ->> 'endGraphemeOffset')::integer
          BETWEEN (block.value ->> 'startGraphemeOffset')::integer
          AND (block.value ->> 'endGraphemeOffset')::integer
        ORDER BY (block.value ->> 'ordinal')::integer
        LIMIT 1
      ) AS end_block
      WHERE node.value ->> 'nodeKey' = p_anchor ->> 'nodeKey'
        AND (p_anchor ->> 'startGraphemeOffset')::integer
          BETWEEN start_block.start_offset AND start_block.end_offset
        AND end_block.ordinal >= start_block.ordinal
        AND (p_anchor ->> 'endGraphemeOffset')::integer <= end_block.end_offset
    )
  ), false);
$$;
