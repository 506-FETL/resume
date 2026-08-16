CREATE TABLE public.automerge_documents (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  resume_id uuid NOT NULL,
  user_id uuid NOT NULL,
  document_data bytea NOT NULL,
  heads text[] NOT NULL,
  document_version integer NOT NULL DEFAULT 1,
  change_count integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT automerge_documents_pkey PRIMARY KEY (id),
  CONSTRAINT automerge_documents_resume_id_key UNIQUE (resume_id),
  CONSTRAINT automerge_documents_resume_id_fkey
    FOREIGN KEY (resume_id) REFERENCES public.resume_config (resume_id) ON DELETE CASCADE,
  CONSTRAINT automerge_documents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX idx_automerge_docs_user
  ON public.automerge_documents (user_id);

CREATE INDEX idx_automerge_docs_resume
  ON public.automerge_documents (resume_id);

CREATE INDEX idx_automerge_docs_updated
  ON public.automerge_documents (updated_at DESC);

CREATE TRIGGER update_automerge_docs_updated_at
  BEFORE UPDATE ON public.automerge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
