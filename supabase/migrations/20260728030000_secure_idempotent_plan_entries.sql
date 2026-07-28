alter table public.financial_plan_templates
add constraint financial_plan_templates_amount_sen_safe_check
check (amount_sen <= 9007199254740991);

alter table public.financial_plan_entries
add column actual_amount_sen bigint,
add column paid_date date,
add column notes text,
add constraint financial_plan_entries_amount_sen_safe_check
  check (amount_sen <= 9007199254740991),
add constraint financial_plan_entries_actual_amount_sen_check
  check (
    actual_amount_sen is null
    or actual_amount_sen between 0 and 9007199254740991
  );

drop policy "Authenticated users can insert their financial plan entries"
on public.financial_plan_entries;

drop policy "Authenticated users can update their financial plan entries"
on public.financial_plan_entries;

drop policy "Authenticated users can delete their financial plan entries"
on public.financial_plan_entries;

revoke insert, update, delete
on public.financial_plan_entries
from authenticated;

create or replace function public.generate_monthly_plan(p_period_start date)
returns table (period_start date, generated_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period_end date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_period_start is null
    or date_trunc('month', p_period_start)::date <> p_period_start
  then
    raise exception 'period_start must be the first day of a calendar month'
      using errcode = '22007';
  end if;

  v_period_end := (p_period_start + interval '1 month - 1 day')::date;

  return query
  with eligible_templates as (
    select
      template.*,
      least(
        p_period_start
          + (coalesce(template.expected_day, template.due_day)::integer - 1),
        v_period_end
      ) as generated_entry_date
    from public.financial_plan_templates as template
    where template.user_id = v_user_id
      and template.is_active
      and template.recurrence = 'monthly'
  ),
  inserted as (
    insert into public.financial_plan_entries (
      template_id,
      user_id,
      period_start,
      entry_date,
      name,
      entry_type,
      amount_sen,
      recurrence,
      expected_day,
      due_day,
      status,
      template_effective_start,
      template_effective_end
    )
    select
      template.id,
      template.user_id,
      p_period_start,
      template.generated_entry_date,
      template.name,
      template.entry_type,
      template.amount_sen,
      template.recurrence,
      template.expected_day,
      template.due_day,
      template.status,
      template.effective_start,
      template.effective_end
    from eligible_templates as template
    where template.generated_entry_date >= template.effective_start
      and (
        template.effective_end is null
        or template.generated_entry_date <= template.effective_end
      )
    on conflict on constraint financial_plan_entries_template_period_key
      do nothing
    returning 1
  )
  select p_period_start, count(*)::integer
  from inserted;
end;
$$;

revoke all on function public.generate_monthly_plan(date) from public;
grant execute on function public.generate_monthly_plan(date) to authenticated;

create function public.update_financial_plan_entry(
  p_entry_id uuid,
  p_status text,
  p_actual_amount_sen bigint,
  p_paid_date date,
  p_notes text
)
returns table (
  status text,
  actual_amount_sen bigint,
  paid_date date,
  notes text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  update public.financial_plan_entries as entry
  set
    status = p_status,
    actual_amount_sen = p_actual_amount_sen,
    paid_date = p_paid_date,
    notes = p_notes
  where entry.id = p_entry_id
    and entry.user_id = v_user_id
  returning
    entry.status,
    entry.actual_amount_sen,
    entry.paid_date,
    entry.notes;

  if not found then
    raise exception 'financial plan entry not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_financial_plan_entry(
  uuid,
  text,
  bigint,
  date,
  text
) from public;

grant execute on function public.update_financial_plan_entry(
  uuid,
  text,
  bigint,
  date,
  text
) to authenticated;
