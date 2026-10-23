-- Live UI save operation. Project and instrument are optional even when the
-- category displays those controls; the frontend provides a warning instead.
create or replace function public.save_time_entry_with_allocation(
  p_user_email text,
  p_department_id uuid,
  p_category_id uuid,
  p_project_id uuid,
  p_instrument_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_hours numeric,
  p_daily_hours jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entry_id uuid;
  v_email text := lower(trim(p_user_email));
  v_allocated_hours numeric;
  v_day_count integer;
begin
  if v_email = '' then raise exception 'User email is required.'; end if;
  if p_end_date < p_start_date then raise exception 'End date cannot be before start date.'; end if;
  if p_total_hours < 0 or p_total_hours > 744 then raise exception 'Hours must be between 0 and 744.'; end if;
  if not exists (select 1 from public.departments where id = p_department_id and is_active) then raise exception 'Invalid or inactive department.'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and is_active) then raise exception 'Invalid or inactive category.'; end if;
  if p_project_id is not null and not exists (select 1 from public.projects where id = p_project_id and is_active) then raise exception 'Invalid or inactive project.'; end if;
  if p_instrument_id is not null and not exists (select 1 from public.instruments where id = p_instrument_id and is_active) then raise exception 'Invalid or inactive instrument.'; end if;

  select coalesce(sum(hours), 0), count(*) into v_allocated_hours, v_day_count
  from jsonb_to_recordset(p_daily_hours) as allocation(work_date date, hours numeric);
  if v_day_count = 0 or v_allocated_hours <> p_total_hours then raise exception 'Daily allocations must equal total hours.'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_daily_hours) as allocation(work_date date, hours numeric)
    where work_date < p_start_date or work_date > p_end_date or hours < 0 or hours > 744
  ) then raise exception 'One or more daily allocations are invalid.'; end if;
  if exists (
    select work_date from jsonb_to_recordset(p_daily_hours) as allocation(work_date date, hours numeric)
    group by work_date having count(*) > 1
  ) then raise exception 'A work date may only occur once per entry.'; end if;

  insert into public.time_entries (user_email, department_id, category_id, project_id, instrument_id, start_date, end_date, total_hours)
  values (v_email, p_department_id, p_category_id, p_project_id, p_instrument_id, p_start_date, p_end_date, p_total_hours)
  returning id into v_entry_id;

  insert into public.time_entry_days (entry_id, user_email, work_date, hours)
  select v_entry_id, v_email, work_date, hours
  from jsonb_to_recordset(p_daily_hours) as allocation(work_date date, hours numeric);

  return v_entry_id;
end;
$$;

revoke execute on function public.save_time_entry_with_allocation(text, uuid, uuid, uuid, uuid, date, date, numeric, jsonb)
  from public, anon, authenticated;

grant execute on function public.save_time_entry_with_allocation(text, uuid, uuid, uuid, uuid, date, date, numeric, jsonb)
  to service_role;
