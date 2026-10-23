-- Dashboard aggregation and admin user-picker functions.
-- Run this once in Supabase SQL Editor before deploying the matching Code.gs/UI changes.

create or replace function public.dashboard_category_hours(
  p_start_date date,
  p_end_date date,
  p_user_emails text[] default null,
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_project_id uuid default null,
  p_instrument_id uuid default null
)
returns table(category_name text, hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(c.name, 'Archived category')::text as category_name,
    round(sum(d.hours)::numeric, 2) as hours
  from public.time_entry_days d
  join public.time_entries e on e.id = d.entry_id
  left join public.categories c on c.id = e.category_id
  where d.work_date between p_start_date and p_end_date
    and (p_user_emails is null or d.user_email = any(p_user_emails))
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_category_id is null or e.category_id = p_category_id)
    and (p_project_id is null or e.project_id = p_project_id)
    and (p_instrument_id is null or e.instrument_id = p_instrument_id)
  group by coalesce(c.name, 'Archived category')
  order by hours desc, category_name asc;
$$;

create or replace function public.dashboard_user_emails()
returns table(email text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct user_email::text as email
  from public.time_entries
  where user_email is not null and btrim(user_email) <> ''
  order by email;
$$;

create or replace function public.dashboard_resource_rows(
  p_start_date date,
  p_end_date date,
  p_user_emails text[] default null,
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_project_id uuid default null,
  p_instrument_id uuid default null
)
returns table(
  department_name text,
  category_name text,
  user_email text,
  instrument_name text,
  project_name text,
  hours numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(department.name, 'Archived department')::text as department_name,
    coalesce(category.name, 'Archived category')::text as category_name,
    e.user_email::text as user_email,
    coalesce(instrument.name, '')::text as instrument_name,
    coalesce(project.name, '')::text as project_name,
    round(sum(e.total_hours)::numeric, 2) as hours
  from public.time_entries e
  left join public.departments department on department.id = e.department_id
  left join public.categories category on category.id = e.category_id
  left join public.projects project on project.id = e.project_id
  left join public.instruments instrument on instrument.id = e.instrument_id
  where e.start_date between p_start_date and p_end_date
    and (p_user_emails is null or e.user_email = any(p_user_emails))
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_category_id is null or e.category_id = p_category_id)
    and (p_project_id is null or e.project_id = p_project_id)
    and (p_instrument_id is null or e.instrument_id = p_instrument_id)
  group by 1, 2, 3, 4, 5
  order by hours desc, department_name asc, category_name asc;
$$;

grant execute on function public.dashboard_category_hours(date, date, text[], uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.dashboard_user_emails() to service_role;
grant execute on function public.dashboard_resource_rows(date, date, text[], uuid, uuid, uuid, uuid) to service_role;
