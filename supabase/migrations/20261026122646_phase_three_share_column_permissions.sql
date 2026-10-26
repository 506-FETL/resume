-- Management uses a column allowlist so password_hash remains server-only.
grant select (purpose, show_phone, show_email),
  insert (purpose, show_phone, show_email)
on public.resume_shares to authenticated;
