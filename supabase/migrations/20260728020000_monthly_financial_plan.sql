create table public.financial_plan_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  entry_type text not null,
  amount_sen bigint not null,
  effective_start date not null,
  effective_end date,
  recurrence text not null default 'monthly',
  expected_day smallint,
  due_day smallint,
  status text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_plan_templates_id_user_id_key unique (id, user_id),
  constraint financial_plan_templates_name_check check (btrim(name) <> ''),
  constraint financial_plan_templates_entry_type_check
    check (entry_type in ('income', 'commitment', 'savings', 'investment')),
  constraint financial_plan_templates_amount_sen_check check (amount_sen >= 0),
  constraint financial_plan_templates_effective_dates_check
    check (effective_end is null or effective_end >= effective_start),
  constraint financial_plan_templates_recurrence_check check (recurrence = 'monthly'),
  constraint financial_plan_templates_schedule_and_status_check check (
    (
      entry_type = 'income'
      and expected_day between 1 and 31
      and due_day is null
      and status in ('pending', 'confirmed')
    )
    or (
      entry_type = 'commitment'
      and expected_day is null
      and due_day between 1 and 31
      and status in ('active', 'inactive')
    )
    or (
      entry_type in ('savings', 'investment')
      and expected_day is null
      and due_day between 1 and 31
      and status = 'planned'
    )
  )
);

create index financial_plan_templates_user_id_idx
on public.financial_plan_templates (user_id);

create table public.financial_plan_entries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  entry_date date not null,
  name text not null,
  entry_type text not null,
  amount_sen bigint not null,
  recurrence text not null,
  expected_day smallint,
  due_day smallint,
  status text not null,
  template_effective_start date not null,
  template_effective_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_plan_entries_template_owner_fkey
    foreign key (template_id, user_id)
    references public.financial_plan_templates (id, user_id)
    on delete restrict,
  constraint financial_plan_entries_template_period_key
    unique (template_id, period_start),
  constraint financial_plan_entries_period_start_check
    check (date_trunc('month', period_start)::date = period_start),
  constraint financial_plan_entries_entry_date_check
    check (date_trunc('month', entry_date)::date = period_start),
  constraint financial_plan_entries_name_check check (btrim(name) <> ''),
  constraint financial_plan_entries_entry_type_check
    check (entry_type in ('income', 'commitment', 'savings', 'investment')),
  constraint financial_plan_entries_amount_sen_check check (amount_sen >= 0),
  constraint financial_plan_entries_effective_dates_check check (
    template_effective_end is null
    or template_effective_end >= template_effective_start
  ),
  constraint financial_plan_entries_recurrence_check check (recurrence = 'monthly'),
  constraint financial_plan_entries_schedule_and_status_check check (
    (
      entry_type = 'income'
      and expected_day between 1 and 31
      and due_day is null
      and status in ('pending', 'confirmed')
    )
    or (
      entry_type = 'commitment'
      and expected_day is null
      and due_day between 1 and 31
      and status in ('active', 'inactive')
    )
    or (
      entry_type in ('savings', 'investment')
      and expected_day is null
      and due_day between 1 and 31
      and status = 'planned'
    )
  )
);

create index financial_plan_entries_user_period_idx
on public.financial_plan_entries (user_id, period_start);

alter table public.financial_plan_templates enable row level security;
alter table public.financial_plan_entries enable row level security;

create policy "Authenticated users can select their financial plan templates"
on public.financial_plan_templates
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their financial plan templates"
on public.financial_plan_templates
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their financial plan templates"
on public.financial_plan_templates
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their financial plan templates"
on public.financial_plan_templates
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their financial plan entries"
on public.financial_plan_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their financial plan entries"
on public.financial_plan_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their financial plan entries"
on public.financial_plan_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their financial plan entries"
on public.financial_plan_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete
on public.financial_plan_templates
to authenticated;

grant select, insert, update, delete
on public.financial_plan_entries
to authenticated;

create trigger set_financial_plan_templates_updated_at
before update on public.financial_plan_templates
for each row execute function public.set_updated_at();

create trigger set_financial_plan_entries_updated_at
before update on public.financial_plan_entries
for each row execute function public.set_updated_at();

create function public.generate_monthly_plan(p_period_start date)
returns table (period_start date, generated_count integer)
language plpgsql
security invoker
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
    returning 1
  )
  select p_period_start, count(*)::integer
  from inserted;
end;
$$;

revoke all on function public.generate_monthly_plan(date) from public;
grant execute on function public.generate_monthly_plan(date) to authenticated;
