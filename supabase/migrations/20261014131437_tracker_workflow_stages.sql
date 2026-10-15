-- Expand accepted workflow stages without rewriting existing application history.
alter table public.company drop constraint if exists company_status_check;

alter table public.company add constraint company_status_check
  check (status in ('saved', 'applied', 'assessment', 'screen', 'written', 'interview', 'offer', 'rejected'));
