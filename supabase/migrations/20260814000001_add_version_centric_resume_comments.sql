-- 20260814000001_add_version_centric_resume_comments.sql
-- 将正文、分享与评论统一绑定到稳定的 resume_config_versions.id。
-- 迁移只增加字段并保留 legacy scope/release，便于灰度与回滚。

ALTER TABLE public.resume_config_versions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS document_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS projection_reference_date date;

ALTER TABLE public.resume_config
  ADD COLUMN IF NOT EXISTS current_version_id bigint;

ALTER TABLE public.resume_shares
  ADD COLUMN IF NOT EXISTS version_id bigint;

ALTER TABLE public.resume_comment_scopes
  ADD COLUMN IF NOT EXISTS version_id bigint,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.resume_comment_anonymous_identities
  ADD COLUMN IF NOT EXISTS version_id bigint;

-- 既有版本此前都是不可变历史快照。
UPDATE public.resume_config_versions
SET status = 'frozen',
    projection_reference_date = coalesce(
      projection_reference_date,
      created_at::date
    )
WHERE status IS NULL
   OR projection_reference_date IS NULL;

-- 每份云端简历建立一个稳定的活动版本。快照字段保持数据库命名；客户端
-- mapSourceToPersistedSnapshot 同时兼容 template_binding 与 templateBinding。
WITH inserted AS (
  INSERT INTO public.resume_config_versions (
    user_id,
    resume_id,
    version_name,
    source_type,
    snapshot,
    content_hash,
    base_updated_at,
    status,
    document_revision,
    projection_reference_date
  )
  SELECT
    config.user_id,
    config.resume_id,
    '当前工作版本',
    'autosave',
    to_jsonb(config)
      - 'id'
      - 'created_at'
      - 'user_id'
      - 'updated_at'
      - 'resume_id'
      - 'display_name'
      - 'description'
      - 'automerge_enabled'
      - 'document_version'
      - 'current_version_id',
    working.document_hash,
    config.updated_at,
    'active',
    coalesce(working.document_revision, 1),
    coalesce(working.projection_reference_date, current_date)
  FROM public.resume_config AS config
  LEFT JOIN public.resume_comment_scopes AS working
    ON working.resume_id = config.resume_id
   AND working.kind = 'working'
  WHERE config.current_version_id IS NULL
  RETURNING id, resume_id
)
UPDATE public.resume_config AS config
SET current_version_id = inserted.id
FROM inserted
WHERE config.resume_id = inserted.resume_id;

-- 若迁移曾在添加活动版本后中断，从现有 active 行恢复指针。
UPDATE public.resume_config AS config
SET current_version_id = active.id
FROM public.resume_config_versions AS active
WHERE config.current_version_id IS NULL
  AND active.resume_id = config.resume_id
  AND active.status = 'active';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resume_config
    WHERE current_version_id IS NULL
  ) THEN
    RAISE EXCEPTION 'active resume version backfill is incomplete';
  END IF;
END;
$$;

ALTER TABLE public.resume_config_versions
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN projection_reference_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_config_versions'::regclass
      AND conname = 'resume_config_versions_status_check'
  ) THEN
    ALTER TABLE public.resume_config_versions
      ADD CONSTRAINT resume_config_versions_status_check
      CHECK (status IN ('active', 'frozen'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_config_versions'::regclass
      AND conname = 'resume_config_versions_document_revision_check'
  ) THEN
    ALTER TABLE public.resume_config_versions
      ADD CONSTRAINT resume_config_versions_document_revision_check
      CHECK (document_revision > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_config'::regclass
      AND conname = 'resume_config_current_version_id_fkey'
  ) THEN
    ALTER TABLE public.resume_config
      ADD CONSTRAINT resume_config_current_version_id_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES public.resume_config_versions (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_shares'::regclass
      AND conname = 'resume_shares_version_id_fkey'
  ) THEN
    ALTER TABLE public.resume_shares
      ADD CONSTRAINT resume_shares_version_id_fkey
      FOREIGN KEY (version_id)
      REFERENCES public.resume_config_versions (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_comment_scopes'::regclass
      AND conname = 'resume_comment_scopes_version_id_fkey'
  ) THEN
    ALTER TABLE public.resume_comment_scopes
      ADD CONSTRAINT resume_comment_scopes_version_id_fkey
      FOREIGN KEY (version_id)
      REFERENCES public.resume_config_versions (id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resume_comment_anonymous_identities'::regclass
      AND conname = 'resume_comment_anonymous_identities_version_id_fkey'
  ) THEN
    ALTER TABLE public.resume_comment_anonymous_identities
      ADD CONSTRAINT resume_comment_anonymous_identities_version_id_fkey
      FOREIGN KEY (version_id)
      REFERENCES public.resume_config_versions (id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_config_versions_one_active
  ON public.resume_config_versions (resume_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_resume_config_versions_status
  ON public.resume_config_versions (resume_id, status, version_no DESC);

-- 分享链接绑定明确版本。current 来源跟随迁移时的活动版本；历史来源使用
-- 已记录的 source_version_id。运行时不再通过内容哈希推断版本。
UPDATE public.resume_shares AS shares
SET version_id = CASE
  WHEN shares.source_kind = 'history' AND shares.source_version_id IS NOT NULL
    THEN shares.source_version_id
  ELSE config.current_version_id
END
FROM public.resume_config AS config
WHERE shares.version_id IS NULL
  AND config.resume_id = shares.resume_id;

CREATE INDEX IF NOT EXISTS idx_resume_shares_version
  ON public.resume_shares (version_id, archived_at, is_active);

GRANT SELECT (version_id) ON TABLE public.resume_shares TO authenticated;
GRANT INSERT (version_id) ON TABLE public.resume_shares TO authenticated;

-- 先把 legacy scope 映射到目标版本。
UPDATE public.resume_comment_scopes AS scopes
SET version_id = config.current_version_id
FROM public.resume_config AS config
WHERE scopes.version_id IS NULL
  AND scopes.kind = 'working'
  AND config.resume_id = scopes.resume_id;

UPDATE public.resume_comment_scopes
SET version_id = history_version_id
WHERE version_id IS NULL
  AND kind = 'history'
  AND history_version_id IS NOT NULL;

UPDATE public.resume_comment_scopes AS scopes
SET version_id = coalesce(releases.source_version_id, shares.version_id)
FROM public.resume_share_releases AS releases
JOIN public.resume_shares AS shares ON shares.id = releases.share_id
WHERE scopes.version_id IS NULL
  AND scopes.kind = 'share_release'
  AND scopes.share_release_id = releases.id;

CREATE TABLE IF NOT EXISTS public.resume_comment_scope_version_migrations (
  legacy_scope_id uuid PRIMARY KEY
    REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  version_id bigint NOT NULL
    REFERENCES public.resume_config_versions (id) ON DELETE CASCADE,
  canonical_scope_id uuid NOT NULL
    REFERENCES public.resume_comment_scopes (id) ON DELETE CASCADE,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_comment_scope_version_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_comment_scope_version_migrations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.resume_comment_scope_version_migrations TO service_role;

-- 一个版本可能同时有 working/history/share_release 多个旧空间。优先选择
-- working，其次 history，再次最早创建的空间作为 canonical。
WITH ranked AS (
  SELECT
    id,
    version_id,
    first_value(id) OVER (
      PARTITION BY version_id
      ORDER BY
        CASE kind WHEN 'working' THEN 0 WHEN 'history' THEN 1 ELSE 2 END,
        created_at,
        id
    ) AS canonical_scope_id
  FROM public.resume_comment_scopes
  WHERE version_id IS NOT NULL
)
INSERT INTO public.resume_comment_scope_version_migrations (
  legacy_scope_id,
  version_id,
  canonical_scope_id
)
SELECT id, version_id, canonical_scope_id
FROM ranked
ON CONFLICT (legacy_scope_id) DO UPDATE
SET version_id = excluded.version_id,
    canonical_scope_id = excluded.canonical_scope_id;

-- 暂停会阻止 legacy scope 合并的约束触发器。
DROP TRIGGER IF EXISTS validate_resume_comment_thread_anchor
  ON public.resume_comment_threads;
DROP TRIGGER IF EXISTS validate_resume_comment_resolved_actor
  ON public.resume_comment_threads;
DROP TRIGGER IF EXISTS validate_resume_comment_author_scope
  ON public.resume_comments;

-- 读游标按 canonical scope 合并。保守地保留各 principal 的最大已读序号；
-- 合并完成后会被限制到 canonical 最新序号。
CREATE TEMP TABLE resume_comment_read_state_merge ON COMMIT DROP AS
SELECT
  mapping.canonical_scope_id AS scope_id,
  states.principal_kind,
  states.principal_user_id,
  states.principal_anonymous_id,
  max(states.last_read_event_seq) AS last_read_event_seq,
  max(states.updated_at) AS updated_at
FROM public.resume_comment_read_states AS states
JOIN public.resume_comment_scope_version_migrations AS mapping
  ON mapping.legacy_scope_id = states.scope_id
GROUP BY
  mapping.canonical_scope_id,
  states.principal_kind,
  states.principal_user_id,
  states.principal_anonymous_id;

DELETE FROM public.resume_comment_read_states AS states
USING public.resume_comment_scope_version_migrations AS mapping
WHERE states.scope_id = mapping.legacy_scope_id;

UPDATE public.resume_comment_threads AS threads
SET scope_id = mapping.canonical_scope_id
FROM public.resume_comment_scope_version_migrations AS mapping
WHERE threads.scope_id = mapping.legacy_scope_id
  AND mapping.legacy_scope_id <> mapping.canonical_scope_id;

UPDATE public.resume_comment_collaboration_sessions AS sessions
SET scope_id = mapping.canonical_scope_id
FROM public.resume_comment_scope_version_migrations AS mapping
WHERE sessions.scope_id = mapping.legacy_scope_id
  AND mapping.legacy_scope_id <> mapping.canonical_scope_id;

DROP INDEX IF EXISTS public.idx_resume_comment_events_scope_seq;

UPDATE public.resume_comment_events AS events
SET scope_id = mapping.canonical_scope_id
FROM public.resume_comment_scope_version_migrations AS mapping
WHERE events.scope_id = mapping.legacy_scope_id
  AND mapping.legacy_scope_id <> mapping.canonical_scope_id;

WITH resequenced AS (
  SELECT
    events.id,
    row_number() OVER (
      PARTITION BY events.scope_id
      ORDER BY events.created_at, events.id
    ) AS event_seq
  FROM public.resume_comment_events AS events
  WHERE events.scope_id IN (
    SELECT DISTINCT canonical_scope_id
    FROM public.resume_comment_scope_version_migrations
  )
)
UPDATE public.resume_comment_events AS events
SET event_seq = reseq.event_seq
FROM resequenced AS reseq
WHERE events.id = reseq.id;

CREATE UNIQUE INDEX idx_resume_comment_events_scope_seq
  ON public.resume_comment_events (scope_id, event_seq);

-- canonical scope 改为明确的 version 类型；空的 legacy scope 保留并归档。
ALTER TABLE public.resume_comment_scopes
  DROP CONSTRAINT IF EXISTS resume_comment_scopes_kind_check,
  DROP CONSTRAINT IF EXISTS resume_comment_scopes_kind_reference_check;

UPDATE public.resume_comment_scopes AS scopes
SET kind = 'version',
    history_version_id = NULL,
    share_release_id = NULL,
    archived_at = NULL
WHERE scopes.id IN (
  SELECT DISTINCT canonical_scope_id
  FROM public.resume_comment_scope_version_migrations
);

UPDATE public.resume_comment_scopes AS scopes
SET version_id = NULL,
    archived_at = coalesce(archived_at, now())
WHERE scopes.id IN (
  SELECT legacy_scope_id
  FROM public.resume_comment_scope_version_migrations
  WHERE legacy_scope_id <> canonical_scope_id
);

ALTER TABLE public.resume_comment_scopes
  ADD CONSTRAINT resume_comment_scopes_kind_check
  CHECK (kind IN ('working', 'history', 'share_release', 'version'));

ALTER TABLE public.resume_comment_scopes
  ADD CONSTRAINT resume_comment_scopes_kind_reference_check
  CHECK (
    (kind = 'working' AND history_version_id IS NULL AND share_release_id IS NULL AND version_id IS NULL)
    OR (kind = 'history' AND history_version_id IS NOT NULL AND share_release_id IS NULL AND version_id IS NULL)
    OR (kind = 'share_release' AND history_version_id IS NULL AND share_release_id IS NOT NULL AND version_id IS NULL)
    OR (kind = 'version' AND history_version_id IS NULL AND share_release_id IS NULL AND version_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_scopes_version_unique
  ON public.resume_comment_scopes (version_id)
  WHERE kind = 'version' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resume_comment_scopes_owner_version
  ON public.resume_comment_scopes (owner_user_id, version_id)
  WHERE kind = 'version' AND archived_at IS NULL;

UPDATE public.resume_comment_scopes AS scopes
SET next_event_seq = coalesce(latest.event_seq, 0)
FROM (
  SELECT scope_id, max(event_seq) AS event_seq
  FROM public.resume_comment_events
  GROUP BY scope_id
) AS latest
WHERE scopes.id = latest.scope_id;

INSERT INTO public.resume_comment_read_states (
  scope_id,
  principal_kind,
  principal_user_id,
  principal_anonymous_id,
  last_read_event_seq,
  updated_at
)
SELECT
  merged.scope_id,
  merged.principal_kind,
  merged.principal_user_id,
  merged.principal_anonymous_id,
  least(merged.last_read_event_seq, scopes.next_event_seq),
  merged.updated_at
FROM resume_comment_read_state_merge AS merged
JOIN public.resume_comment_scopes AS scopes ON scopes.id = merged.scope_id
ON CONFLICT DO NOTHING;

-- 迁移后无法在 canonical 文档中验证的 legacy 锚点进入“失去锚点”，
-- 绝不因为相似文字而误挂。
UPDATE public.resume_comment_threads AS threads
SET anchor_status = 'detached',
    updated_at = now()
FROM public.resume_comment_scopes AS scopes
WHERE scopes.id = threads.scope_id
  AND scopes.kind = 'version'
  AND threads.anchor_status = 'anchored'
  AND NOT public.is_valid_resume_comment_anchor_check(
    threads.anchor,
    scopes.anchor_document
  );

-- 匿名身份改为版本级。保留 origin share 供审计，但删除链接不能级联删除
-- 仍被同版本其他链接使用的身份。
UPDATE public.resume_comment_anonymous_identities AS identities
SET version_id = shares.version_id
FROM public.resume_shares AS shares
WHERE identities.version_id IS NULL
  AND shares.id = identities.share_id;

ALTER TABLE public.resume_comment_anonymous_identities
  ALTER COLUMN version_id SET NOT NULL,
  ALTER COLUMN share_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS resume_comment_anonymous_identities_share_id_fkey;

ALTER TABLE public.resume_comment_anonymous_identities
  ADD CONSTRAINT resume_comment_anonymous_identities_share_id_fkey
  FOREIGN KEY (share_id)
  REFERENCES public.resume_shares (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resume_comment_anonymous_identities_version
  ON public.resume_comment_anonymous_identities (version_id, revoked_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_comment_anonymous_identity_secret_version
  ON public.resume_comment_anonymous_identities (version_id, secret_hash);

-- 匿名作者/解决者只需与评论版本一致，不要求仍从同一分享链接进入。
CREATE OR REPLACE FUNCTION public.validate_resume_comment_resolved_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_scope_version_id bigint;
  v_identity_version_id bigint;
BEGIN
  IF NEW.resolved_at IS NULL OR NEW.resolved_by_kind <> 'anonymous' THEN
    RETURN NEW;
  END IF;

  SELECT version_id INTO v_scope_version_id
  FROM public.resume_comment_scopes
  WHERE id = NEW.scope_id;

  SELECT version_id INTO v_identity_version_id
  FROM public.resume_comment_anonymous_identities
  WHERE id = NEW.resolved_by_id
    AND revoked_at IS NULL;

  IF v_scope_version_id IS NULL
    OR v_identity_version_id IS DISTINCT FROM v_scope_version_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'anonymous resolver does not belong to the thread version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_resume_comment_resolved_actor
  AFTER INSERT OR UPDATE OF scope_id, resolved_at, resolved_by_kind, resolved_by_id
  ON public.resume_comment_threads
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_resolved_actor();

CREATE OR REPLACE FUNCTION public.validate_resume_comment_author_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_scope_version_id bigint;
  v_identity_version_id bigint;
BEGIN
  IF NEW.author_kind = 'user' THEN
    RETURN NEW;
  END IF;

  SELECT scopes.version_id INTO v_scope_version_id
  FROM public.resume_comment_threads AS threads
  JOIN public.resume_comment_scopes AS scopes ON scopes.id = threads.scope_id
  WHERE threads.id = NEW.thread_id;

  SELECT version_id INTO v_identity_version_id
  FROM public.resume_comment_anonymous_identities
  WHERE id = NEW.author_anonymous_id
    AND revoked_at IS NULL;

  IF v_scope_version_id IS NULL
    OR v_identity_version_id IS DISTINCT FROM v_scope_version_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'anonymous author does not belong to the comment version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_resume_comment_author_scope
  AFTER INSERT OR UPDATE OF thread_id, author_kind, author_anonymous_id
  ON public.resume_comments
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_author_scope();

-- 回复可以指向同一线程中的任意评论，并阻止更新形成环。
CREATE OR REPLACE FUNCTION public.validate_resume_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_parent_thread_id uuid;
  v_cycle boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comment cannot reply to itself';
  END IF;

  SELECT thread_id INTO v_parent_thread_id
  FROM public.resume_comments
  WHERE id = NEW.parent_id;
  IF NOT FOUND OR v_parent_thread_id <> NEW.thread_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'reply parent must belong to the same thread';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id
    FROM public.resume_comments
    WHERE id = NEW.parent_id
    UNION ALL
    SELECT comments.id, comments.parent_id
    FROM public.resume_comments AS comments
    JOIN ancestors ON comments.id = ancestors.parent_id
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO v_cycle;
  IF v_cycle THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comment reply cycle detected';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_comment_parent ON public.resume_comments;
CREATE CONSTRAINT TRIGGER validate_resume_comment_parent
  AFTER INSERT OR UPDATE OF thread_id, parent_id
  ON public.resume_comments
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_parent();

-- 恢复锚点验证；迁移期间不可靠的旧锚点已标记 detached。
CREATE TRIGGER validate_resume_comment_thread_anchor
  BEFORE INSERT OR UPDATE OF scope_id, anchor
  ON public.resume_comment_threads
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_comment_thread_anchor();

-- 手动创建新版本：冻结旧版本，复制正文与锚点文档，创建空评论空间，
-- 原分享链接仍指向旧 version_id。
CREATE OR REPLACE FUNCTION public.create_next_resume_version(
  p_resume_id uuid,
  p_version_name text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config public.resume_config%ROWTYPE;
  v_current public.resume_config_versions%ROWTYPE;
  v_current_scope public.resume_comment_scopes%ROWTYPE;
  v_new_version_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT * INTO v_config
  FROM public.resume_config
  WHERE resume_id = p_resume_id
    AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND OR v_config.current_version_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'active resume version not found';
  END IF;

  SELECT * INTO v_current
  FROM public.resume_config_versions
  WHERE id = v_config.current_version_id
    AND resume_id = p_resume_id
    AND user_id = auth.uid()
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'active resume version not found';
  END IF;

  SELECT * INTO v_current_scope
  FROM public.resume_comment_scopes
  WHERE version_id = v_current.id
    AND kind = 'version'
    AND archived_at IS NULL
  FOR UPDATE;

  UPDATE public.resume_config_versions
  SET status = 'frozen'
  WHERE id = v_current.id;

  INSERT INTO public.resume_config_versions (
    user_id,
    resume_id,
    version_name,
    description,
    milestone_name,
    source_type,
    tags,
    snapshot,
    content_hash,
    base_updated_at,
    status,
    document_revision,
    projection_reference_date
  ) VALUES (
    v_current.user_id,
    v_current.resume_id,
    nullif(btrim(p_version_name), ''),
    v_current.description,
    v_current.milestone_name,
    'manual',
    v_current.tags,
    v_current.snapshot,
    v_current.content_hash,
    v_current.updated_at,
    'active',
    1,
    current_date
  ) RETURNING id INTO v_new_version_id;

  IF v_current_scope.id IS NOT NULL THEN
    INSERT INTO public.resume_comment_scopes (
      kind,
      owner_user_id,
      resume_id,
      version_id,
      anchor_document,
      document_hash,
      document_revision,
      projection_reference_date,
      next_event_seq
    ) VALUES (
      'version',
      v_current_scope.owner_user_id,
      v_current_scope.resume_id,
      v_new_version_id,
      v_current_scope.anchor_document,
      v_current_scope.document_hash,
      1,
      current_date,
      0
    );
  END IF;

  UPDATE public.resume_config
  SET current_version_id = v_new_version_id
  WHERE resume_id = p_resume_id;

  RETURN v_new_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_next_resume_version(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_next_resume_version(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_resume_current_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.current_version_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.resume_config_versions AS versions
    WHERE versions.id = NEW.current_version_id
      AND versions.resume_id = NEW.resume_id
      AND versions.user_id = NEW.user_id
      AND versions.status = 'active'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'current version must be the active version of the resume';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_resume_current_version ON public.resume_config;
CREATE CONSTRAINT TRIGGER validate_resume_current_version
  AFTER INSERT OR UPDATE OF current_version_id, resume_id, user_id
  ON public.resume_config
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_resume_current_version();

DROP POLICY IF EXISTS "resume_shares_insert_own" ON public.resume_shares;
CREATE POLICY "resume_shares_insert_own" ON public.resume_shares
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.resume_config
      WHERE resume_config.resume_id = resume_shares.resume_id
        AND resume_config.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.resume_config_versions
      WHERE resume_config_versions.id = resume_shares.version_id
        AND resume_config_versions.resume_id = resume_shares.resume_id
        AND resume_config_versions.user_id = auth.uid()
    )
  );

-- 阻止普通 UPDATE 修改冻结版本正文或破坏活动版本归属。
CREATE OR REPLACE FUNCTION public.guard_resume_version_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'frozen' AND (
    NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.document_revision IS DISTINCT FROM OLD.document_revision
    OR NEW.projection_reference_date IS DISTINCT FROM OLD.projection_reference_date
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'frozen resume version is immutable';
  END IF;
  IF NEW.resume_id IS DISTINCT FROM OLD.resume_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.version_no IS DISTINCT FROM OLD.version_no THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'resume version identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_resume_version_state
  ON public.resume_config_versions;
CREATE TRIGGER guard_resume_version_state
  BEFORE UPDATE ON public.resume_config_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_resume_version_state();

-- 所有 share / version 指针回填必须完整。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.resume_shares WHERE version_id IS NULL
  ) THEN
    RAISE EXCEPTION 'resume share version backfill is incomplete';
  END IF;
  IF EXISTS (
    SELECT resume_id
    FROM public.resume_config_versions
    WHERE status = 'active'
    GROUP BY resume_id
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'resume active version invariant is violated';
  END IF;
END;
$$;
