alter table public.financial_plan_entries
drop constraint financial_plan_entries_schedule_and_status_check;

alter table public.financial_plan_entries
add constraint financial_plan_entries_schedule_and_status_check check (
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
    and status in ('active', 'inactive', 'pending', 'paid')
  )
  or (
    entry_type in ('savings', 'investment')
    and expected_day is null
    and due_day between 1 and 31
    and status = 'planned'
  )
);

update public.financial_plan_entries
set status = 'pending'
where entry_type = 'commitment'
  and status = 'paid'
  and paid_date is null;

update public.financial_plan_entries
set paid_date = null
where entry_type <> 'commitment'
  or status <> 'paid';

alter table public.financial_plan_entries
add constraint financial_plan_entries_execution_paid_date_check check (
  (
    entry_type = 'commitment'
    and (
      (status = 'paid' and paid_date is not null)
      or (status <> 'paid' and paid_date is null)
    )
  )
  or (
    entry_type <> 'commitment'
    and paid_date is null
  )
);
