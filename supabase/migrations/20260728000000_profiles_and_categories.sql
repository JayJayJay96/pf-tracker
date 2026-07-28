create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'RM',
  time_zone text not null default 'Asia/Kuala_Lumpur',
  period_type text not null default 'calendar_month',
  default_payment_method text not null default 'tng',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_currency_check check (currency in ('RM')),
  constraint profiles_period_type_check
    check (period_type in ('calendar_month', 'salary_cycle')),
  constraint profiles_default_payment_method_check
    check (default_payment_method in ('tng', 'cash'))
);

create index profiles_user_id_idx on public.profiles (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_check check (btrim(name) <> ''),
  constraint categories_type_check
    check (type in ('expense', 'commitment', 'savings', 'investment', 'income')),
  constraint categories_sort_order_check check (sort_order >= 0)
);

create index categories_user_id_idx on public.categories (user_id);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;

create policy "Authenticated users can select their profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their categories"
on public.categories
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their categories"
on public.categories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their categories"
on public.categories
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their categories"
on public.categories
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
