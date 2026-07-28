alter table public.categories
add constraint categories_user_id_id_type_key unique (user_id, id, type);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  merchant text,
  amount_sen bigint not null,
  transaction_date date not null,
  recorded_at timestamptz not null default now(),
  category_id uuid not null,
  category_type text not null default 'expense',
  payment_method text not null,
  transaction_type text not null default 'personal_expense',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_owner_category_fkey
    foreign key (user_id, category_id, category_type)
    references public.categories (user_id, id, type),
  constraint transactions_category_type_check check (category_type = 'expense'),
  constraint transactions_description_check check (btrim(description) <> ''),
  constraint transactions_amount_sen_check
    check (amount_sen > 0 and amount_sen <= 9007199254740991),
  constraint transactions_payment_method_check
    check (payment_method in ('tng', 'cash')),
  constraint transactions_type_check
    check (transaction_type = 'personal_expense')
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_user_date_idx
on public.transactions (user_id, transaction_date desc);
create index transactions_user_category_idx
on public.transactions (user_id, category_id);

alter table public.transactions enable row level security;

create policy "Authenticated users can select their transactions"
on public.transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their transactions"
on public.transactions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their transactions"
on public.transactions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their transactions"
on public.transactions
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.transactions to authenticated;

create function public.set_transaction_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed_at timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    new.recorded_at = changed_at;
    new.created_at = changed_at;
  else
    new.recorded_at = old.recorded_at;
    new.created_at = old.created_at;
  end if;
  new.updated_at = changed_at;
  return new;
end;
$$;

revoke all on function public.set_transaction_updated_at() from public;

create trigger transactions_set_audit_timestamps
before insert or update on public.transactions
for each row execute function public.set_transaction_updated_at();
