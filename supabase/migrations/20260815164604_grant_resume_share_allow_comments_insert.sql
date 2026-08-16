-- Keep the local ledger version aligned with the already-applied remote migration.
GRANT INSERT (allow_comments)
ON TABLE public.resume_shares
TO authenticated;
