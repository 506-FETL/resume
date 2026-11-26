create view public.tracker_job_cards with (security_invoker = true) as
select j.id, j.user_id, j.created_at, j.updated_at, j.company, j.company_logo,
  j.tracker_company_id, j.recruitment_batch, j.referred_from_job_id, j.position,
  j.location, j.salary, j.job_url, j.resume_id, j.status, coalesce(j.archived, false) as archived,
  j.next_action, j.next_action_date, j.focused_at,
  facts.has_primary as has_submission, facts.unresolved as unresolved_submissions
from public.company j
cross join lateral (
  select coalesce(bool_or(s.is_primary), false) as has_primary,
    count(*) > 0 and not bool_or(s.is_primary) as unresolved
  from public.job_submissions s where s.job_id = j.id and s.user_id = j.user_id
) facts;

revoke all on public.tracker_job_cards from public, anon, authenticated, service_role;
grant select on public.tracker_job_cards to authenticated;

create function private.tracker_matches_search(p_company text, p_position text, p_location text, p_salary text, p_company_id uuid, p_focused timestamptz, filters jsonb)
returns boolean language sql immutable parallel safe security invoker set search_path = ''
as $$
  select (filters->>'companyId' is null or p_company_id = (filters->>'companyId')::uuid)
    and (not coalesce((filters->>'focused')::boolean,false) or p_focused is not null)
    and (coalesce(filters->>'keyword','') = '' or
      strpos(lower(p_company), lower(filters->>'keyword')) > 0 or strpos(lower(p_position), lower(filters->>'keyword')) > 0 or
      strpos(lower(p_location), lower(filters->>'keyword')) > 0 or strpos(lower(coalesce(p_salary,'')),lower(filters->>'keyword')) > 0)
$$;

create function private.tracker_pending(p_status text, p_archived boolean, p_due date, p_updated timestamptz, p_today date, p_stale timestamptz)
returns boolean language sql immutable parallel safe security invoker set search_path = ''
as $$
  select not p_archived and p_status not in ('offer','rejected') and
    case when p_due is not null then p_due <= p_today else coalesce(p_updated,'epoch') < p_stale + interval '1 millisecond' end
$$;

create function private.tracker_matches_stage(p_status text, p_archived boolean, p_due date, p_updated timestamptz, filters jsonb)
returns boolean language sql stable parallel safe security invoker set search_path = ''
as $$
  select (filters->>'status' is null or p_status = filters->>'status') and
    case filters->>'metric'
      when 'applied' then p_status in ('applied','assessment','screen','written','interview')
      when 'interview' then p_status='interview' when 'offer' then p_status='offer'
      when 'pending' then private.tracker_pending(p_status,p_archived,p_due,p_updated,(filters->>'today')::date,(filters->>'staleBefore')::timestamptz)
      else true end
$$;

create function private.tracker_sort_value(p_updated timestamptz, p_created timestamptz, p_status text, filters jsonb)
returns numeric language sql stable parallel safe security invoker set search_path = ''
as $$
  select (case filters->>'sortBy'
    when 'created' then floor(extract(epoch from coalesce(p_created,'epoch')) * 1000)
    when 'days' then greatest(0,floor((extract(epoch from (filters->>'now')::timestamptz)*1000-floor(extract(epoch from coalesce(p_updated,'epoch'))*1000))/86400000))
    when 'status' then array_position(array['saved','applied','assessment','screen','written','interview','offer','rejected'],p_status)
    else floor(extract(epoch from coalesce(p_updated,'epoch')) * 1000) end) *
    case when filters->>'sortDir'='asc' then -1 else 1 end
$$;

revoke all on function private.tracker_matches_search(text,text,text,text,uuid,timestamptz,jsonb), private.tracker_pending(text,boolean,date,timestamptz,date,timestamptz),private.tracker_matches_stage(text,boolean,date,timestamptz,jsonb),private.tracker_sort_value(timestamptz,timestamptz,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function private.tracker_matches_search(text,text,text,text,uuid,timestamptz,jsonb), private.tracker_pending(text,boolean,date,timestamptz,date,timestamptz),private.tracker_matches_stage(text,boolean,date,timestamptz,jsonb),private.tracker_sort_value(timestamptz,timestamptz,text,jsonb) to authenticated;

-- The first board request returns a bounded slice of every lane in its original creation order.
create function public.get_tracker_job_page(
  p_archived boolean, p_board boolean, p_limit integer, p_status text default null,
  p_cursor_time timestamptz default null, p_cursor_id uuid default null, p_filters jsonb default '{}'
) returns setof public.tracker_job_cards
language plpgsql stable security invoker set search_path = ''
as $$
declare v_limit integer := least(greatest(p_limit, 1), 201);
begin
  if not p_board and (p_filters ? 'sortBy' or p_filters ? 'sortDir') then
    return query select c.* from public.tracker_job_cards c
    where c.user_id = (select auth.uid()) and c.archived = p_archived
      and private.tracker_matches_search(c.company,c.position,c.location,c.salary,c.tracker_company_id,c.focused_at,p_filters)
      and private.tracker_matches_stage(c.status,c.archived,c.next_action_date,c.updated_at,p_filters)
      and (p_cursor_id is null or
        (private.tracker_sort_value(c.updated_at,c.created_at,c.status,p_filters),coalesce(c.created_at,'infinity'),c.id)
        < (private.tracker_sort_value(p_cursor_time,(p_filters->>'cursorCreated')::timestamptz,p_filters->>'cursorStatus',p_filters),coalesce((p_filters->>'cursorCreated')::timestamptz,'infinity'),p_cursor_id))
    order by private.tracker_sort_value(c.updated_at,c.created_at,c.status,p_filters) desc,c.created_at desc nulls first,c.id desc limit v_limit;
    return;
  end if;

  if not p_board then
    return query select c.* from public.tracker_job_cards c
    where c.user_id = (select auth.uid()) and c.archived = p_archived
      and private.tracker_matches_search(c.company,c.position,c.location,c.salary,c.tracker_company_id,c.focused_at,p_filters)
      and private.tracker_matches_stage(c.status,c.archived,c.next_action_date,c.updated_at,p_filters)
      and (p_cursor_id is null or (coalesce(c.updated_at, 'infinity'), c.id) < (coalesce(p_cursor_time, 'infinity'), p_cursor_id))
    order by c.updated_at desc nulls first, c.id desc limit v_limit;
    return;
  end if;

  return query select page.*
  from unnest(case when p_status is null then array['saved','applied','assessment','screen','written','interview','offer','rejected'] else array[p_status] end) as lane(status)
  cross join lateral (
    select c.* from public.tracker_job_cards c
    where c.user_id = (select auth.uid()) and c.archived = p_archived and c.status = lane.status
      and private.tracker_matches_search(c.company,c.position,c.location,c.salary,c.tracker_company_id,c.focused_at,p_filters)
      and private.tracker_matches_stage(c.status,c.archived,c.next_action_date,c.updated_at,p_filters)
      and (p_cursor_id is null or (coalesce(c.created_at, 'infinity'), c.id) < (coalesce(p_cursor_time, 'infinity'), p_cursor_id))
    order by c.created_at desc nulls first, c.id desc limit v_limit
  ) page;
end;
$$;

revoke all on function public.get_tracker_job_page(boolean,boolean,integer,text,timestamptz,uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.get_tracker_job_page(boolean,boolean,integer,text,timestamptz,uuid,jsonb) to authenticated;

-- Mirrors normalizeJobWorkflow followed by getFurthestStageIndex for legacy and reverted processes.
create function private.tracker_has_response(p_status text, p_stages jsonb, p_activities jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $$
declare
  stages text[] := array['saved','applied','assessment','screen','written','interview'];
  labels text[] := array['已保存','已投递','测评中','筛选中','笔试中','面试中','已录用'];
  details jsonb := coalesce(nullif(p_stages,'null'), '[]');
  activities jsonb := coalesce(nullif(p_activities,'null'), '[]');
  terminal jsonb;
  ended text;
  n integer;
begin
  if p_status in ('assessment','screen','written','interview','offer') then return true; end if;
  if exists (select 1 from jsonb_array_elements(details) d
    where d->>'stage' in ('assessment','screen','written','interview','offer') and coalesce(d->>'start_date','') <> '') then return true; end if;
  if exists (select 1 from jsonb_array_elements(activities) a cross join unnest(labels[3:7]) l
    where a->>'type' = 'status_change' and
      (a->>'label' in ('推进到「'||l||'」','回退到「'||l||'」') or a->>'note' in ('结束于：'||l,'录用于：'||l))) then return true; end if;
  if p_status <> 'rejected' then return false; end if;

  select d into terminal from jsonb_array_elements(details) d where d->>'stage' = 'rejected' limit 1;
  if terminal ? 'source_stage' then ended := terminal->>'source_stage';
  else
    select count(*), min(d->>'stage') into n, ended from jsonb_array_elements(details) d
      where d->>'stage' = any(stages) and d->>'status' = '已拒绝';
    if n <> 1 then
      select stages[i] into ended from jsonb_array_elements(activities) with ordinality a(item, seq)
        cross join generate_series(1,6) i where a.item->>'type' = 'status_change' and
          (a.item->>'note' in ('结束于：'||labels[i], '录用于：'||labels[i]) or
            right(a.item->>'label', length(labels[i])+2) = '「'||labels[i]||'」')
        order by a.seq desc, i limit 1;
      if ended is null then
        select case when count(*) = 1 then min(d->>'stage') end into ended
          from jsonb_array_elements(details) d where d->>'stage' = any(stages) and d->>'status' = '进行中';
      end if;
    end if;
  end if;
  if ended is not null then return ended = any(stages[3:6]); end if;

  return exists (select 1 from jsonb_array_elements(details) d where d->>'stage' = any(stages[3:6]) and d->>'status' = '已完成');
end;
$$;

revoke all on function private.tracker_has_response(text,jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function private.tracker_has_response(text,jsonb,jsonb) to authenticated;

create function public.get_tracker_job_counts(p_today date, p_stale_before timestamptz, p_filters jsonb default '{}')
returns jsonb language sql stable security invoker set search_path = ''
as $$
  with grouped as (
    select coalesce(j.archived,false) as archived, j.status, count(*) as n,
      count(*) filter (where private.tracker_pending(j.status,coalesce(j.archived,false),j.next_action_date,j.updated_at,p_today,p_stale_before)) as pending
    from public.company j where j.user_id = (select auth.uid()) and private.tracker_matches_search(j.company,j.position,j.location,j.salary,j.tracker_company_id,j.focused_at,p_filters) group by 1,2
  ), facts as (
    select s.job_id, bool_or(s.is_primary) as confirmed from public.job_submissions s
    where coalesce((p_filters->>'includeHistory')::boolean,true) and s.user_id = (select auth.uid()) group by s.job_id
  ), history as (
    select count(*) filter(where f.confirmed) as applied, count(*) filter(where not f.confirmed) as unresolved,
      count(*) filter(where f.confirmed and private.tracker_has_response(j.status,j.stage_details,j.activities)) as responded
    from facts f join public.company j on j.id = f.job_id where j.user_id = (select auth.uid())
  )
  select jsonb_build_object('active', coalesce((select jsonb_object_agg(status,n) from grouped where not archived),'{}'),
    'archived', coalesce((select jsonb_object_agg(status,n) from grouped where archived),'{}'),
    'pendingByStage', coalesce((select jsonb_object_agg(status,pending) from grouped where not archived),'{}'),
    'pending', coalesce((select sum(pending) from grouped),0),
    'archivedTotal', (select count(*) from public.company j where coalesce((p_filters->>'includeHistory')::boolean,true) and j.user_id=(select auth.uid()) and j.archived),
    'historicalApplied', applied, 'responded', responded, 'unresolvedSubmissions', unresolved) from history;
$$;

revoke all on function public.get_tracker_job_counts(date,timestamptz,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.get_tracker_job_counts(date,timestamptz,jsonb) to authenticated;
