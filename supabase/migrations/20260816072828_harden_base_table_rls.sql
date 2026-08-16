-- Fail closed if historical rows cannot satisfy the owner boundary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ats AS child
    LEFT JOIN public.resume_config AS parent ON parent.resume_id = child.resume_id
    WHERE child.user_id IS NULL
       OR parent.resume_id IS NULL
       OR child.user_id IS DISTINCT FROM parent.user_id
  ) THEN
    RAISE EXCEPTION 'ats contains rows without a matching owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.automerge_documents AS child
    LEFT JOIN public.resume_config AS parent ON parent.resume_id = child.resume_id
    WHERE parent.resume_id IS NULL
       OR child.user_id IS DISTINCT FROM parent.user_id
  ) THEN
    RAISE EXCEPTION 'automerge_documents contains rows without a matching owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.resume_config_versions AS child
    LEFT JOIN public.resume_config AS parent ON parent.resume_id = child.resume_id
    WHERE parent.resume_id IS NULL
       OR child.user_id IS DISTINCT FROM parent.user_id
  ) THEN
    RAISE EXCEPTION 'resume_config_versions contains rows without a matching owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company AS child
    JOIN public.resume_config AS parent ON parent.resume_id = child.resume_id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) THEN
    RAISE EXCEPTION 'company contains rows without a matching owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.resume_config AS child
    JOIN public.resume_config AS parent ON parent.resume_id = child.parent_resume_id
    WHERE child.user_id IS DISTINCT FROM parent.user_id
  ) THEN
    RAISE EXCEPTION 'resume_config contains a cross-owner parent reference';
  END IF;

  -- Community templates are no longer an authorization boundary. Existing bindings must be
  -- migrated explicitly instead of silently retaining a cross-user lookup path.
  IF EXISTS (
    SELECT 1
    FROM public.resume_config
    WHERE template_binding ->> 'source' = 'community'
  ) OR EXISTS (
    SELECT 1
    FROM public.resume_config_versions
    WHERE snapshot #>> '{templateBinding,source}' = 'community'
       OR snapshot #>> '{template_binding,source}' = 'community'
  ) THEN
    RAISE EXCEPTION 'legacy community template bindings require an owner copy before RLS hardening';
  END IF;
END;
$$;

ALTER TABLE public.ats ALTER COLUMN user_id SET NOT NULL;

UPDATE public.resume_templates
SET visibility = 'private',
    manifest = pg_catalog.jsonb_set(
      manifest,
      '{meta,visibility}',
      '"private"'::jsonb,
      true
    )
WHERE visibility IS DISTINCT FROM 'private'
   OR manifest #>> '{meta,visibility}' IS DISTINCT FROM 'private';

ALTER TABLE public.resume_templates
  DROP CONSTRAINT IF EXISTS resume_templates_visibility_check;
ALTER TABLE public.resume_templates
  ADD CONSTRAINT resume_templates_visibility_check
  CHECK (visibility = 'private');

ALTER TABLE public.resume_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automerge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_templates ENABLE ROW LEVEL SECURITY;

-- Remove every historical policy on the six base tables so permissive policies cannot compose.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'resume_config',
        'resume_config_versions',
        'ats',
        'automerge_documents',
        'company',
        'resume_templates'
      ])
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.resume_config
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_config_versions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ats
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.automerge_documents
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.company
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.resume_templates
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_config
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_config_versions
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ats
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automerge_documents
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_templates
  TO authenticated;

GRANT ALL ON TABLE public.resume_config TO service_role;
GRANT ALL ON TABLE public.resume_config_versions TO service_role;
GRANT ALL ON TABLE public.ats TO service_role;
GRANT ALL ON TABLE public.automerge_documents TO service_role;
GRANT ALL ON TABLE public.company TO service_role;
GRANT ALL ON TABLE public.resume_templates TO service_role;

REVOKE ALL ON SEQUENCE public.resume_config_id_seq
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.resume_config_versions_id_seq
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ats_id_seq
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.resume_templates_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.resume_config_id_seq
  TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.resume_config_versions_id_seq
  TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ats_id_seq
  TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.resume_templates_id_seq
  TO authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_user_owns_resume(p_resume_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resume_config
    WHERE resume_id = p_resume_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_owns_resume(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_owns_resume(uuid)
  TO authenticated, service_role;

CREATE POLICY resume_config_select_own
  ON public.resume_config
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_config_insert_own
  ON public.resume_config
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      parent_resume_id IS NULL
      OR private.current_user_owns_resume(parent_resume_id)
    )
  );

CREATE POLICY resume_config_update_own
  ON public.resume_config
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      parent_resume_id IS NULL
      OR private.current_user_owns_resume(parent_resume_id)
    )
  );

CREATE POLICY resume_config_delete_own
  ON public.resume_config
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_config_versions_select_own
  ON public.resume_config_versions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY resume_config_versions_insert_own
  ON public.resume_config_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY resume_config_versions_update_own
  ON public.resume_config_versions
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY resume_config_versions_delete_own
  ON public.resume_config_versions
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY ats_select_own
  ON public.ats
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY ats_insert_own
  ON public.ats
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY ats_update_own
  ON public.ats
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY ats_delete_own
  ON public.ats
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY automerge_documents_select_own
  ON public.automerge_documents
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY automerge_documents_insert_own
  ON public.automerge_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY automerge_documents_update_own
  ON public.automerge_documents
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND private.current_user_owns_resume(resume_id)
  );

CREATE POLICY automerge_documents_delete_own
  ON public.automerge_documents
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY company_select_own
  ON public.company
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY company_insert_own
  ON public.company
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      resume_id IS NULL
      OR private.current_user_owns_resume(resume_id)
    )
  );

CREATE POLICY company_update_own
  ON public.company
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      resume_id IS NULL
      OR private.current_user_owns_resume(resume_id)
    )
  );

CREATE POLICY company_delete_own
  ON public.company
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_templates_select_own
  ON public.resume_templates
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_templates_insert_own
  ON public.resume_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_templates_update_own
  ON public.resume_templates
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY resume_templates_delete_own
  ON public.resume_templates
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Anonymous readers never touch share/comment tables directly. Edge Functions use service_role.
REVOKE ALL ON TABLE public.resume_shares FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.resume_shares FROM authenticated;
REVOKE ALL ON TABLE public.resume_share_releases FROM PUBLIC, anon;
