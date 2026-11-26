-- The list follows the last update; each board lane follows creation order.
-- Both queries can stop before joining submission facts for the remaining jobs.
create index tracker_list_page_order
  on public.company (user_id, (coalesce(archived, false)), updated_at desc, id desc);

create index tracker_board_page_order
  on public.company (user_id, (coalesce(archived, false)), status, created_at desc, id desc);
