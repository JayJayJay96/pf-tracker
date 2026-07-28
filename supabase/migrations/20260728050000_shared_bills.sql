alter table public.transactions
  drop constraint transactions_type_check,
  alter column category_id drop not null,
  add column shared_status text,
  add column resolved_at timestamptz,
  add constraint transactions_type_check
    check (transaction_type in ('personal_expense', 'shared_expense')),
  add constraint transactions_shared_shape_check check (
    (
      transaction_type = 'personal_expense'
      and category_id is not null
      and shared_status is null
      and resolved_at is null
    )
    or
    (
      transaction_type = 'shared_expense'
      and category_id is null
      and (
        (shared_status = 'unresolved' and resolved_at is null)
        or (shared_status = 'resolved' and resolved_at is not null)
      )
    )
  ),
  add constraint transactions_user_id_id_key unique (user_id, id);

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friends_name_check check (btrim(name) <> ''),
  constraint friends_user_id_id_key unique (user_id, id)
);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  description text not null,
  amount_sen bigint not null,
  discount_sen bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint bill_items_transaction_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) on delete cascade,
  constraint bill_items_description_check check (btrim(description) <> ''),
  constraint bill_items_amount_check
    check (amount_sen >= 0 and amount_sen <= 9007199254740991),
  constraint bill_items_discount_check
    check (discount_sen >= 0 and discount_sen <= amount_sen),
  constraint bill_items_owner_transaction_id_key
    unique (user_id, transaction_id, id)
);

create table public.bill_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  participant_kind text not null,
  friend_id uuid,
  amount_sen bigint not null,
  created_at timestamptz not null default now(),
  constraint bill_participants_transaction_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) on delete cascade,
  constraint bill_participants_friend_fkey
    foreign key (user_id, friend_id)
    references public.friends (user_id, id),
  constraint bill_participants_kind_check
    check (participant_kind in ('user', 'friend')),
  constraint bill_participants_shape_check check (
    (participant_kind = 'user' and friend_id is null)
    or (participant_kind = 'friend' and friend_id is not null)
  ),
  constraint bill_participants_amount_check
    check (amount_sen >= 0 and amount_sen <= 9007199254740991),
  constraint bill_participants_owner_transaction_id_key
    unique (user_id, transaction_id, id)
);

create unique index bill_participants_one_user_idx
on public.bill_participants (transaction_id)
where participant_kind = 'user';

create unique index bill_participants_one_friend_idx
on public.bill_participants (transaction_id, friend_id)
where participant_kind = 'friend';

create table public.item_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  item_id uuid not null,
  participant_id uuid not null,
  created_at timestamptz not null default now(),
  constraint item_assignments_transaction_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) on delete cascade,
  constraint item_assignments_item_fkey
    foreign key (user_id, transaction_id, item_id)
    references public.bill_items (user_id, transaction_id, id) on delete cascade,
  constraint item_assignments_participant_fkey
    foreign key (user_id, transaction_id, participant_id)
    references public.bill_participants (user_id, transaction_id, id) on delete cascade,
  constraint item_assignments_unique
    unique (item_id, participant_id)
);

create table public.bill_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  adjustment_kind text not null,
  amount_sen bigint not null,
  distribution_method text not null,
  allocation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bill_adjustments_transaction_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id) on delete cascade,
  constraint bill_adjustments_kind_check
    check (adjustment_kind in ('discount', 'service', 'tax', 'rounding')),
  constraint bill_adjustments_amount_check
    check (amount_sen >= 0 and amount_sen <= 9007199254740991),
  constraint bill_adjustments_distribution_check
    check (distribution_method in ('proportional', 'equal', 'selected', 'user', 'manual')),
  constraint bill_adjustments_allocation_check
    check (jsonb_typeof(allocation) = 'object')
);

create index friends_user_id_idx on public.friends (user_id);
create index bill_items_owner_transaction_idx
on public.bill_items (user_id, transaction_id);
create index bill_participants_owner_transaction_idx
on public.bill_participants (user_id, transaction_id);
create index item_assignments_owner_transaction_idx
on public.item_assignments (user_id, transaction_id);
create index bill_adjustments_owner_transaction_idx
on public.bill_adjustments (user_id, transaction_id);

alter table public.friends enable row level security;
alter table public.bill_items enable row level security;
alter table public.bill_participants enable row level security;
alter table public.item_assignments enable row level security;
alter table public.bill_adjustments enable row level security;

create policy "Authenticated users can select their friends"
on public.friends for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Authenticated users can insert their friends"
on public.friends for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can update their friends"
on public.friends for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can delete their friends"
on public.friends for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their bill items"
on public.bill_items for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Authenticated users can insert their bill items"
on public.bill_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can update their bill items"
on public.bill_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can delete their bill items"
on public.bill_items for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their bill participants"
on public.bill_participants for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Authenticated users can insert their bill participants"
on public.bill_participants for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can update their bill participants"
on public.bill_participants for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can delete their bill participants"
on public.bill_participants for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their item assignments"
on public.item_assignments for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Authenticated users can insert their item assignments"
on public.item_assignments for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can update their item assignments"
on public.item_assignments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can delete their item assignments"
on public.item_assignments for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their bill adjustments"
on public.bill_adjustments for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Authenticated users can insert their bill adjustments"
on public.bill_adjustments for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can update their bill adjustments"
on public.bill_adjustments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Authenticated users can delete their bill adjustments"
on public.bill_adjustments for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.friends to authenticated;
grant select, insert, update, delete on public.bill_items to authenticated;
grant select, insert, update, delete on public.bill_participants to authenticated;
grant select, insert, update, delete on public.item_assignments to authenticated;
grant select, insert, update, delete on public.bill_adjustments to authenticated;

create function public.prevent_resolved_shared_bill_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transaction_type = 'shared_expense'
    and old.shared_status = 'resolved'
  then
    raise exception using
      errcode = '55000',
      message = 'resolved shared bills are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_resolved_shared_bill_change() from public;

create trigger transactions_prevent_resolved_shared_bill_change
before update or delete on public.transactions
for each row execute function public.prevent_resolved_shared_bill_change();

create function public.prevent_resolved_allocation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_transaction_id uuid :=
    case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
begin
  if exists (
    select 1
    from public.transactions
    where id = target_transaction_id
      and shared_status = 'resolved'
  ) then
    raise exception using
      errcode = '55000',
      message = 'resolved shared bill allocations are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_resolved_allocation_change() from public;

create trigger bill_items_prevent_resolved_change
before insert or update or delete on public.bill_items
for each row execute function public.prevent_resolved_allocation_change();
create trigger bill_participants_prevent_resolved_change
before insert or update or delete on public.bill_participants
for each row execute function public.prevent_resolved_allocation_change();
create trigger item_assignments_prevent_resolved_change
before insert or update or delete on public.item_assignments
for each row execute function public.prevent_resolved_allocation_change();
create trigger bill_adjustments_prevent_resolved_change
before insert or update or delete on public.bill_adjustments
for each row execute function public.prevent_resolved_allocation_change();

create function public.resolve_shared_bill(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  transaction_total bigint;
  item_total numeric;
  participant_total numeric;
  user_count bigint;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select amount_sen
  into transaction_total
  from public.transactions
  where id = p_transaction_id
    and user_id = owner_id
    and transaction_type = 'shared_expense'
    and shared_status = 'unresolved'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'unresolved shared bill not found';
  end if;

  select
    coalesce(sum(amount_sen - discount_sen), 0)
    + coalesce((
      select sum(
        case when adjustment_kind = 'discount' then -amount_sen else amount_sen end
      )
      from public.bill_adjustments
      where user_id = owner_id
        and transaction_id = p_transaction_id
    ), 0)
  into item_total
  from public.bill_items
  where user_id = owner_id
    and transaction_id = p_transaction_id;

  if item_total <> transaction_total then
    raise exception using
      errcode = '23514',
      message = 'bill items and adjustments do not reconcile to transaction total';
  end if;

  select coalesce(sum(amount_sen), 0),
    count(*) filter (where participant_kind = 'user')
  into participant_total, user_count
  from public.bill_participants
  where user_id = owner_id
    and transaction_id = p_transaction_id;

  if participant_total <> transaction_total or user_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'bill participant portions do not reconcile to transaction total';
  end if;

  update public.transactions
  set shared_status = 'resolved',
    resolved_at = clock_timestamp()
  where id = p_transaction_id
    and user_id = owner_id;
end;
$$;

revoke all on function public.resolve_shared_bill(uuid) from public;
grant execute on function public.resolve_shared_bill(uuid) to authenticated;

create function public.save_equal_shared_bill_resolution(
  p_transaction_id uuid,
  p_friend_id uuid,
  p_item_id uuid,
  p_user_participant_id uuid,
  p_friend_participant_id uuid,
  p_item_description text,
  p_user_amount_sen bigint,
  p_friend_amount_sen bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  transaction_total bigint;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select amount_sen
  into transaction_total
  from public.transactions
  where id = p_transaction_id
    and user_id = owner_id
    and transaction_type = 'shared_expense'
    and shared_status = 'unresolved'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'unresolved shared bill not found';
  end if;
  if btrim(p_item_description) = '' then
    raise exception using errcode = '23514', message = 'item description is required';
  end if;
  if
    p_user_amount_sen <> (transaction_total / 2) + (transaction_total % 2)
    or p_friend_amount_sen <> transaction_total / 2
  then
    raise exception using
      errcode = '23514',
      message = 'equal split does not reconcile with user residual';
  end if;
  if not exists (
    select 1
    from public.friends
    where id = p_friend_id
      and user_id = owner_id
  ) then
    raise exception using errcode = '23503', message = 'owned friend not found';
  end if;

  insert into public.bill_items (
    id, user_id, transaction_id, description, amount_sen, discount_sen
  )
  values (
    p_item_id, owner_id, p_transaction_id, btrim(p_item_description),
    transaction_total, 0
  );

  insert into public.bill_participants (
    id, user_id, transaction_id, participant_kind, friend_id, amount_sen
  )
  values
    (
      p_user_participant_id, owner_id, p_transaction_id,
      'user', null, p_user_amount_sen
    ),
    (
      p_friend_participant_id, owner_id, p_transaction_id,
      'friend', p_friend_id, p_friend_amount_sen
    );

  insert into public.item_assignments (
    user_id, transaction_id, item_id, participant_id
  )
  values
    (owner_id, p_transaction_id, p_item_id, p_user_participant_id),
    (owner_id, p_transaction_id, p_item_id, p_friend_participant_id);

  perform public.resolve_shared_bill(p_transaction_id);
end;
$$;

revoke all on function public.save_equal_shared_bill_resolution(
  uuid, uuid, uuid, uuid, uuid, text, bigint, bigint
) from public;
grant execute on function public.save_equal_shared_bill_resolution(
  uuid, uuid, uuid, uuid, uuid, text, bigint, bigint
) to authenticated;
