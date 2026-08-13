\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT coalesce(p_condition, false) THEN
    RAISE EXCEPTION 'assertion failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_sql text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected error: %', p_message;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'expected error: ' || p_message THEN
      RAISE;
    END IF;
END;
$$;

DO $$
DECLARE
  v_owner_id uuid := '00000000-0000-0000-0000-000000000301';
  v_resume_id uuid := '00000000-0000-0000-0000-000000000302';
  v_share_one_id uuid := '00000000-0000-0000-0000-000000000303';
  v_share_two_id uuid := '00000000-0000-0000-0000-000000000304';
  v_history_id bigint;
  v_release_one_id uuid;
  v_release_two_id uuid;
  v_old_release_id uuid;
  v_working_scope_id uuid;
  v_history_scope_id uuid;
  v_release_scope_id uuid;
  v_release_two_scope_id uuid;
  v_thread_id uuid := '00000000-0000-0000-0000-000000000305';
  v_root_comment_id uuid := '00000000-0000-0000-0000-000000000306';
  v_reply_id uuid := '00000000-0000-0000-0000-000000000307';
  v_event_one bigint;
  v_event_two bigint;
  v_retry integer;
  v_api_response jsonb;
  v_api_replay jsonb;
  v_api_thread_id uuid;
  v_api_comment_id uuid;
  v_identity_response jsonb;
  v_anchor_document jsonb := '{
    "nodes": [
      {
        "nodeKey": "basics/singleton/name",
        "text": "张三",
        "blocks": [{"ordinal": 0, "startGraphemeOffset": 0, "endGraphemeOffset": 2}]
      }
    ]
  }'::jsonb;
  v_document_hash text := repeat('a', 64);
  v_anchor jsonb := jsonb_build_object(
    'nodeKey', 'basics/singleton/name',
    'startGraphemeOffset', 0,
    'endGraphemeOffset', 1,
    'blockOrdinal', 0,
    'exactQuote', '张',
    'prefix', '',
    'suffix', '三',
    'nodeTextHash', repeat('b', 64),
    'createdAtContentHash', repeat('a', 64)
  );
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES (
    v_owner_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'resume-comments-owner@example.com',
    '',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  );

  INSERT INTO public.resume_config (resume_id, user_id, display_name)
  VALUES (v_resume_id, v_owner_id, '评论验证简历');

  INSERT INTO public.resume_config_versions (
    user_id,
    resume_id,
    version_no,
    version_name,
    snapshot
  )
  VALUES (v_owner_id, v_resume_id, 1, '验证历史版本', '{}'::jsonb)
  RETURNING id INTO v_history_id;

  INSERT INTO public.resume_shares (
    id,
    resume_id,
    user_id,
    token,
    label,
    snapshot,
    template_manifest,
    display_name,
    source_kind,
    is_active
  )
  VALUES
    (
      v_share_one_id,
      v_resume_id,
      v_owner_id,
      repeat('1', 64),
      '分享一',
      '{}'::jsonb,
      '{}'::jsonb,
      '首发快照',
      'current',
      true
    ),
    (
      v_share_two_id,
      v_resume_id,
      v_owner_id,
      repeat('2', 64),
      '分享二',
      '{}'::jsonb,
      '{}'::jsonb,
      '第二条分享',
      'current',
      true
    );

  -- 模拟任务 2 迁移后的既有 release 回填。
  INSERT INTO public.resume_share_releases (
    share_id,
    release_no,
    snapshot,
    template_manifest,
    display_name,
    source_kind,
    created_by
  )
  VALUES
    (v_share_one_id, 1, '{}'::jsonb, '{}'::jsonb, '首发快照', 'current', v_owner_id),
    (v_share_two_id, 1, '{}'::jsonb, '{}'::jsonb, '第二条分享', 'current', v_owner_id);

  SELECT id INTO v_release_one_id
  FROM public.resume_share_releases
  WHERE share_id = v_share_one_id AND release_no = 1;
  SELECT id INTO v_release_two_id
  FROM public.resume_share_releases
  WHERE share_id = v_share_two_id AND release_no = 1;

  UPDATE public.resume_shares
  SET current_release_id = CASE id
    WHEN v_share_one_id THEN v_release_one_id
    ELSE v_release_two_id
  END
  WHERE id IN (v_share_one_id, v_share_two_id);

  PERFORM pg_temp.assert_true(
    (SELECT current_release_id = v_release_one_id FROM public.resume_shares WHERE id = v_share_one_id),
    '旧分享必须指向回填 release'
  );

  v_release_scope_id := public.ensure_resume_share_release_comment_scope(
    v_release_one_id,
    v_anchor_document,
    v_document_hash,
    current_date
  );
  PERFORM pg_temp.assert_true(
    v_release_scope_id = public.ensure_resume_share_release_comment_scope(
      v_release_one_id,
      v_anchor_document,
      v_document_hash,
      current_date
    ),
    'backfill release scope 必须幂等'
  );

  v_release_two_scope_id := public.ensure_resume_share_release_comment_scope(
    v_release_two_id,
    v_anchor_document,
    v_document_hash,
    current_date
  );
  PERFORM pg_temp.assert_true(
    v_release_two_scope_id <> v_release_scope_id,
    '不同分享链接的 release scope 必须隔离'
  );

  v_working_scope_id := public.ensure_resume_working_comment_scope(
    v_owner_id,
    v_resume_id,
    v_anchor_document,
    v_document_hash,
    current_date
  );
  PERFORM pg_temp.assert_true(
    v_working_scope_id = public.ensure_resume_working_comment_scope(
      v_owner_id,
      v_resume_id,
      v_anchor_document,
      v_document_hash,
      current_date
    ),
    'working scope 必须幂等'
  );

  v_history_scope_id := public.ensure_resume_history_comment_scope(
    v_owner_id,
    v_history_id,
    v_anchor_document,
    v_document_hash,
    current_date
  );
  PERFORM pg_temp.assert_true(
    v_history_scope_id <> v_working_scope_id
      AND v_history_scope_id <> v_release_scope_id,
    'working、history、share_release 必须隔离'
  );

  PERFORM pg_temp.expect_error(
    format(
      'SELECT public.sync_resume_working_comment_document(%L, %L::jsonb, %L, 0, current_date)',
      v_working_scope_id,
      v_anchor_document,
      repeat('c', 64)
    ),
    'expected_document_revision 不匹配必须失败'
  );

  INSERT INTO public.resume_comment_threads (
    id,
    scope_id,
    anchor
  )
  VALUES (v_thread_id, v_working_scope_id, v_anchor);

  PERFORM pg_temp.expect_error(
    format(
      'SELECT public.assert_resume_comment_anchor(%L, %L::jsonb, %L)',
      v_working_scope_id,
      v_anchor,
      repeat('d', 64)
    ),
    'document_hash 不匹配必须失败'
  );

  INSERT INTO public.resume_comments (
    id,
    thread_id,
    author_kind,
    author_user_id,
    body
  )
  VALUES (v_root_comment_id, v_thread_id, 'user', v_owner_id, '主评论');

  INSERT INTO public.resume_comments (
    id,
    thread_id,
    parent_id,
    author_kind,
    author_user_id,
    body
  )
  VALUES (v_reply_id, v_thread_id, v_root_comment_id, 'user', v_owner_id, '一级回复');

  PERFORM pg_temp.expect_error(
    format(
      'INSERT INTO public.resume_comments (thread_id, parent_id, author_kind, author_user_id, body) VALUES (%L, %L, %L, %L, %L)',
      v_thread_id,
      v_reply_id,
      'user',
      v_owner_id,
      '禁止回复回复'
    ),
    'reply 不能回复 reply'
  );

  v_event_one := public.next_resume_comment_event_seq(v_working_scope_id);
  v_event_two := public.next_resume_comment_event_seq(v_working_scope_id);
  PERFORM pg_temp.assert_true(v_event_two = v_event_one + 1, 'event_seq 必须单调递增');

  PERFORM pg_temp.assert_true(
    public.claim_resume_comment_request('user:' || v_owner_id::text, v_share_one_id),
    '首次 request_id 必须可 claim'
  );
  PERFORM pg_temp.assert_true(
    NOT public.claim_resume_comment_request('user:' || v_owner_id::text, v_share_one_id),
    '相同 actor + request_id 必须被识别为重放'
  );

  v_identity_response := public.create_resume_comment_anonymous_identity(
    v_share_one_id,
    v_release_scope_id,
    repeat('e', 64),
    'anonymous-new:' || repeat('e', 64),
    '00000000-0000-4000-8000-000000000308'
  );
  PERFORM pg_temp.assert_true(
    v_identity_response ->> 'anonymousId' IS NOT NULL
      AND v_identity_response = public.create_resume_comment_anonymous_identity(
        v_share_one_id,
        v_release_scope_id,
        repeat('e', 64),
        'anonymous-new:' || repeat('e', 64),
        '00000000-0000-4000-8000-000000000308'
      ),
    '匿名身份创建必须按 request_id 幂等'
  );

  v_api_response := public.execute_resume_comment_write(
    'create_thread',
    v_working_scope_id,
    'user',
    v_owner_id,
    'user:' || v_owner_id::text,
    '00000000-0000-4000-8000-000000000309',
    jsonb_build_object(
      'manageAll', true,
      'anchor', v_anchor,
      'documentHash', v_document_hash,
      'body', '事务主评论',
      'originalPageIndex', 0
    )
  );
  v_api_thread_id := (v_api_response ->> 'threadId')::uuid;
  v_api_comment_id := (v_api_response ->> 'commentId')::uuid;
  v_api_replay := public.execute_resume_comment_write(
    'create_thread',
    v_working_scope_id,
    'user',
    v_owner_id,
    'user:' || v_owner_id::text,
    '00000000-0000-4000-8000-000000000309',
    jsonb_build_object(
      'manageAll', true,
      'anchor', v_anchor,
      'documentHash', v_document_hash,
      'body', '不会重复创建',
      'originalPageIndex', 0
    )
  );
  PERFORM pg_temp.assert_true(
    v_api_response = v_api_replay
      AND EXISTS (
        SELECT 1 FROM public.resume_comments
        WHERE id = v_api_comment_id AND body = '事务主评论'
      )
      AND (
        SELECT count(*) FROM public.resume_comment_events
        WHERE thread_id = v_api_thread_id AND type = 'thread_created'
      ) = 1
      AND (
        SELECT last_read_event_seq
        FROM public.resume_comment_read_states
        WHERE scope_id = v_working_scope_id
          AND principal_kind = 'user'
          AND principal_user_id = v_owner_id
      ) = (v_api_response ->> 'eventSeq')::bigint,
    '创建线程、主评论和 event 必须事务化且重放不重复'
  );

  v_api_response := public.execute_resume_comment_write(
    'create_reply',
    v_working_scope_id,
    'user',
    v_owner_id,
    'user:' || v_owner_id::text,
    '00000000-0000-4000-8000-000000000310',
    jsonb_build_object(
      'manageAll', true,
      'threadId', v_api_thread_id,
      'expectedRevision', 1,
      'body', '事务回复'
    )
  );
  PERFORM pg_temp.assert_true(
    (v_api_response ->> 'revision')::integer = 2,
    '回复必须递增线程 revision'
  );
  PERFORM pg_temp.expect_error(
    format(
      'SELECT public.execute_resume_comment_write(%L, %L, %L, %L, %L, %L, %L::jsonb)',
      'resolve_thread',
      v_working_scope_id,
      'user',
      v_owner_id,
      'user:' || v_owner_id::text,
      '00000000-0000-4000-8000-000000000311',
      jsonb_build_object(
        'manageAll', true,
        'threadId', v_api_thread_id,
        'expectedRevision', 1
      )::text
    ),
    '旧 thread revision 必须稳定返回冲突'
  );

  v_api_response := public.execute_resume_comment_write(
    'mark_read',
    v_working_scope_id,
    'user',
    v_owner_id,
    'user:' || v_owner_id::text,
    '00000000-0000-4000-8000-000000000312',
    jsonb_build_object('eventSeq', 999999)
  );
  PERFORM pg_temp.assert_true(
    (v_api_response ->> 'eventSeq')::bigint
      = (SELECT next_event_seq FROM public.resume_comment_scopes WHERE id = v_working_scope_id),
    'mark_read 不得越过 scope 最新 event_seq'
  );

  v_api_response := public.sync_resume_working_comment_document_v2(
    v_working_scope_id,
    v_owner_id,
    v_anchor_document,
    v_document_hash,
    1,
    current_date,
    '[]'::jsonb,
    'user:' || v_owner_id::text,
    '00000000-0000-4000-8000-000000000313'
  );
  PERFORM pg_temp.assert_true(
    (v_api_response ->> 'documentRevision')::integer = 2
      AND EXISTS (
        SELECT 1 FROM public.resume_comment_events
        WHERE scope_id = v_working_scope_id AND type = 'document_synced'
      ),
    'working 文档同步必须原子递增 revision 并写 event'
  );

  FOR counter IN 1..5 LOOP
    v_retry := public.check_resume_comment_rate_limit(
      'user:' || v_owner_id::text,
      'network-hash',
      v_share_one_id,
      v_thread_id
    );
    PERFORM pg_temp.assert_true(v_retry = 0, '线程限流前五次应通过');
  END LOOP;
  v_retry := public.check_resume_comment_rate_limit(
    'user:' || v_owner_id::text,
    'network-hash',
    v_share_one_id,
    v_thread_id
  );
  PERFORM pg_temp.assert_true(v_retry BETWEEN 1 AND 60, '第六次线程写应封禁 60 秒内');

  SELECT current_release_id INTO v_old_release_id
  FROM public.resume_shares
  WHERE id = v_share_one_id;

  PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SELECT release_id INTO v_release_one_id
  FROM public.publish_resume_share_release(
    v_share_one_id,
    '{"release":2}'::jsonb,
    '{}'::jsonb,
    '第二次发布',
    'current',
    NULL,
    NULL,
    NULL,
    NULL,
    v_anchor_document,
    v_document_hash,
    current_date
  );

  PERFORM pg_temp.assert_true(
    v_release_one_id <> v_old_release_id
      AND (SELECT current_release_id = v_release_one_id FROM public.resume_shares WHERE id = v_share_one_id)
      AND EXISTS (SELECT 1 FROM public.resume_share_releases WHERE id = v_old_release_id)
      AND EXISTS (
        SELECT 1
        FROM public.resume_comment_scopes
        WHERE share_release_id = v_release_one_id
      ),
    '重新发布必须原子创建 release + scope、切换指针并保留旧 release'
  );

  PERFORM public.archive_resume_share(v_share_two_id, NULL);
  PERFORM pg_temp.assert_true(
    (SELECT archived_at IS NOT NULL AND NOT is_active FROM public.resume_shares WHERE id = v_share_two_id)
      AND EXISTS (SELECT 1 FROM public.resume_share_releases WHERE id = v_release_two_id),
    '归档必须保留 release 数据'
  );

  PERFORM public.delete_resume_share_permanently(v_share_two_id, NULL);
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.resume_shares WHERE id = v_share_two_id)
      AND NOT EXISTS (SELECT 1 FROM public.resume_share_releases WHERE id = v_release_two_id)
      AND NOT EXISTS (SELECT 1 FROM public.resume_comment_scopes WHERE id = v_release_two_scope_id),
    '永久删除必须级联 release 与评论空间'
  );

  PERFORM public.delete_resume_history_version_with_comments(v_history_id, NULL);
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.resume_comment_scopes WHERE id = v_history_scope_id)
      AND EXISTS (SELECT 1 FROM public.resume_share_releases WHERE id = v_old_release_id),
    '删除历史 scope 不能影响独立 share release'
  );
END;
$$;

ROLLBACK;

\echo 'resume comments verification passed'
