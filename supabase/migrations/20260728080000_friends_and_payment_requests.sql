alter table public.friends
  add column nickname text,
  add column phone text,
  add column notes text,
  add column active boolean not null default true,
  add constraint friends_nickname_check
    check (nickname is null or btrim(nickname) <> ''),
  add constraint friends_phone_check
    check (phone is null or btrim(phone) <> '');

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null,
  total_sen bigint not null,
  request_date date not null,
  status text not null default 'pending',
  note text,
  paid_on date,
  cancelled_on date,
  forgiven_on date,
  created_at timestamptz not null default now(),
  constraint payment_requests_friend_fkey
    foreign key (user_id, friend_id)
    references public.friends (user_id, id),
  constraint payment_requests_total_check
    check (total_sen > 0 and total_sen <= 9007199254740991),
  constraint payment_requests_note_check
    check (note is null or btrim(note) <> ''),
  constraint payment_requests_status_check
    check (status in ('pending', 'paid', 'cancelled', 'forgiven')),
  constraint payment_requests_status_dates_check check (
    (status = 'pending'
      and paid_on is null and cancelled_on is null and forgiven_on is null)
    or
    (status = 'paid'
      and paid_on is not null and cancelled_on is null and forgiven_on is null)
    or
    (status = 'cancelled'
      and paid_on is null and cancelled_on is not null and forgiven_on is null)
    or
    (status = 'forgiven'
      and paid_on is null and cancelled_on is null and forgiven_on is not null)
  ),
  constraint payment_requests_user_id_id_key unique (user_id, id)
);

create table public.friend_portion_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  bill_participant_id uuid not null,
  friend_id uuid not null,
  status text not null default 'unrequested',
  payment_request_id uuid,
  settled_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_portion_settlements_participant_fkey
    foreign key (user_id, transaction_id, bill_participant_id)
    references public.bill_participants (user_id, transaction_id, id),
  constraint friend_portion_settlements_friend_fkey
    foreign key (user_id, friend_id)
    references public.friends (user_id, id),
  constraint friend_portion_settlements_request_fkey
    foreign key (user_id, payment_request_id)
    references public.payment_requests (user_id, id),
  constraint friend_portion_settlements_status_check
    check (status in ('unrequested', 'requested', 'paid', 'forgiven')),
  constraint friend_portion_settlements_shape_check check (
    (status = 'unrequested'
      and payment_request_id is null and settled_on is null)
    or
    (status = 'requested'
      and payment_request_id is not null and settled_on is null)
    or
    (status in ('paid', 'forgiven')
      and payment_request_id is not null and settled_on is not null)
  ),
  constraint friend_portion_settlements_portion_key
    unique (user_id, transaction_id, bill_participant_id),
  constraint friend_portion_settlements_user_id_id_key
    unique (user_id, id)
);

create table public.payment_request_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_request_id uuid not null,
  transaction_id uuid not null,
  bill_participant_id uuid not null,
  description_snapshot text not null,
  transaction_date_snapshot date not null,
  amount_sen_snapshot bigint not null,
  created_at timestamptz not null default now(),
  constraint payment_request_items_request_fkey
    foreign key (user_id, payment_request_id)
    references public.payment_requests (user_id, id) on delete cascade,
  constraint payment_request_items_participant_fkey
    foreign key (user_id, transaction_id, bill_participant_id)
    references public.bill_participants (user_id, transaction_id, id),
  constraint payment_request_items_description_check
    check (btrim(description_snapshot) <> ''),
  constraint payment_request_items_amount_check
    check (amount_sen_snapshot > 0
      and amount_sen_snapshot <= 9007199254740991),
  constraint payment_request_items_one_portion_per_request
    unique (payment_request_id, transaction_id, bill_participant_id)
);

create index payment_requests_user_id_idx
on public.payment_requests (user_id);
create index payment_requests_user_friend_idx
on public.payment_requests (user_id, friend_id, request_date desc);
create index friend_portion_settlements_user_id_idx
on public.friend_portion_settlements (user_id);
create index friend_portion_settlements_user_friend_idx
on public.friend_portion_settlements (user_id, friend_id, status);
create index payment_request_items_user_id_idx
on public.payment_request_items (user_id);
create index payment_request_items_user_request_idx
on public.payment_request_items (user_id, payment_request_id);

alter table public.payment_requests enable row level security;
alter table public.friend_portion_settlements enable row level security;
alter table public.payment_request_items enable row level security;

create policy "Authenticated users can select their payment requests"
on public.payment_requests for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their friend portion settlements"
on public.friend_portion_settlements for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can select their payment request items"
on public.payment_request_items for select to authenticated
using ((select auth.uid()) = user_id);

grant select on public.payment_requests to authenticated;
grant select on public.friend_portion_settlements to authenticated;
grant select on public.payment_request_items to authenticated;

create function public.create_friend_portion_settlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.transaction_type = 'shared_expense'
    and new.shared_status = 'resolved'
    and (
      tg_op = 'INSERT'
      or old.shared_status is distinct from new.shared_status
    )
  then
    insert into public.friend_portion_settlements (
      user_id, transaction_id, bill_participant_id, friend_id
    )
    select
      participant.user_id,
      participant.transaction_id,
      participant.id,
      participant.friend_id
    from public.bill_participants as participant
    where participant.user_id = new.user_id
      and participant.transaction_id = new.id
      and participant.participant_kind = 'friend'
      and participant.amount_sen > 0
    on conflict (user_id, transaction_id, bill_participant_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.create_friend_portion_settlements() from public;

create trigger transactions_create_friend_portion_settlements
after insert or update of shared_status on public.transactions
for each row execute function public.create_friend_portion_settlements();

insert into public.friend_portion_settlements (
  user_id, transaction_id, bill_participant_id, friend_id
)
select
  participant.user_id,
  participant.transaction_id,
  participant.id,
  participant.friend_id
from public.bill_participants as participant
join public.transactions as transaction
  on transaction.user_id = participant.user_id
  and transaction.id = participant.transaction_id
where participant.participant_kind = 'friend'
  and participant.amount_sen > 0
  and transaction.shared_status = 'resolved'
on conflict (user_id, transaction_id, bill_participant_id) do nothing;

create function public.prevent_payment_request_item_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception using
    errcode = '55000',
    message = 'payment request snapshots are immutable';
end;
$$;

revoke all on function public.prevent_payment_request_item_change() from public;

create trigger payment_request_items_prevent_change
before update or delete on public.payment_request_items
for each row execute function public.prevent_payment_request_item_change();

create function public.create_payment_request(
  p_friend_id uuid,
  p_portion_ids uuid[],
  p_request_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  new_request_id uuid := gen_random_uuid();
  requested_count integer;
  requested_total numeric;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_friend_id is null
    or p_request_date is null
    or p_portion_ids is null
    or cardinality(p_portion_ids) = 0
    or cardinality(p_portion_ids) <> (
      select count(distinct portion_id)
      from unnest(p_portion_ids) as portion_id
    )
    or (p_note is not null and btrim(p_note) = '')
  then
    raise exception using errcode = '22023', message = 'invalid payment request';
  end if;
  if not exists (
    select 1
    from public.friends
    where user_id = owner_id and id = p_friend_id
  ) then
    raise exception using errcode = '42501', message = 'friend not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(portion_id::text, 0))
  from unnest(p_portion_ids) as portion_id
  order by portion_id;

  perform 1
  from public.friend_portion_settlements as settlement
  where settlement.user_id = owner_id
    and settlement.id = any(p_portion_ids)
  order by settlement.id
  for update;

  select count(*), coalesce(sum(participant.amount_sen), 0)
  into requested_count, requested_total
  from public.friend_portion_settlements as settlement
  join public.bill_participants as participant
    on participant.user_id = settlement.user_id
    and participant.transaction_id = settlement.transaction_id
    and participant.id = settlement.bill_participant_id
  join public.transactions as transaction
    on transaction.user_id = settlement.user_id
    and transaction.id = settlement.transaction_id
  where settlement.user_id = owner_id
    and settlement.id = any(p_portion_ids)
    and settlement.friend_id = p_friend_id
    and settlement.status = 'unrequested'
    and participant.participant_kind = 'friend'
    and participant.friend_id = p_friend_id
    and participant.amount_sen > 0
    and transaction.transaction_type = 'shared_expense'
    and transaction.shared_status = 'resolved';

  if requested_count <> cardinality(p_portion_ids)
    or requested_total <= 0
    or requested_total > 9007199254740991
  then
    raise exception using
      errcode = '55000',
      message = 'one or more portions are not available to request';
  end if;

  insert into public.payment_requests (
    id, user_id, friend_id, total_sen, request_date, note
  )
  values (
    new_request_id,
    owner_id,
    p_friend_id,
    requested_total::bigint,
    p_request_date,
    nullif(btrim(p_note), '')
  );

  insert into public.payment_request_items (
    user_id,
    payment_request_id,
    transaction_id,
    bill_participant_id,
    description_snapshot,
    transaction_date_snapshot,
    amount_sen_snapshot
  )
  select
    owner_id,
    new_request_id,
    settlement.transaction_id,
    settlement.bill_participant_id,
    transaction.description,
    transaction.transaction_date,
    participant.amount_sen
  from public.friend_portion_settlements as settlement
  join public.bill_participants as participant
    on participant.user_id = settlement.user_id
    and participant.transaction_id = settlement.transaction_id
    and participant.id = settlement.bill_participant_id
  join public.transactions as transaction
    on transaction.user_id = settlement.user_id
    and transaction.id = settlement.transaction_id
  where settlement.user_id = owner_id
    and settlement.id = any(p_portion_ids);

  update public.friend_portion_settlements
  set status = 'requested',
    payment_request_id = new_request_id,
    settled_on = null,
    updated_at = clock_timestamp()
  where user_id = owner_id
    and id = any(p_portion_ids)
    and status = 'unrequested';
  get diagnostics requested_count = row_count;

  if requested_count <> cardinality(p_portion_ids) then
    raise exception using
      errcode = '55000',
      message = 'one or more portions are not available to request';
  end if;

  return new_request_id;
end;
$$;

revoke all on function public.create_payment_request(
  uuid, uuid[], date, text
) from public;
grant execute on function public.create_payment_request(
  uuid, uuid[], date, text
) to authenticated;

create function public.transition_payment_request(
  p_request_id uuid,
  p_status text,
  p_paid_amount_sen bigint,
  p_occurred_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  current_request public.payment_requests%rowtype;
  transitioned_count integer;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_occurred_on is null
    or p_status not in ('paid', 'cancelled', 'forgiven')
  then
    raise exception using errcode = '22023', message = 'invalid payment request transition';
  end if;

  select *
  into current_request
  from public.payment_requests
  where user_id = owner_id and id = p_request_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'payment request not found';
  end if;
  if current_request.status <> 'pending' then
    raise exception using errcode = '55000', message = 'payment request is already settled';
  end if;
  if p_status = 'paid'
    and p_paid_amount_sen is distinct from current_request.total_sen
  then
    raise exception using
      errcode = '22023',
      message = 'payment must match the full requested amount';
  end if;
  if p_status <> 'paid' and p_paid_amount_sen is not null then
    raise exception using errcode = '22023', message = 'invalid payment request transition';
  end if;

  if p_status = 'cancelled' then
    update public.friend_portion_settlements
    set status = 'unrequested',
      payment_request_id = null,
      settled_on = null,
      updated_at = clock_timestamp()
    where user_id = owner_id
      and payment_request_id = p_request_id
      and status = 'requested';
  else
    update public.friend_portion_settlements
    set status = p_status,
      settled_on = p_occurred_on,
      updated_at = clock_timestamp()
    where user_id = owner_id
      and payment_request_id = p_request_id
      and status = 'requested';
  end if;
  get diagnostics transitioned_count = row_count;

  if transitioned_count = 0
    or transitioned_count <> (
      select count(*)
      from public.payment_request_items
      where user_id = owner_id and payment_request_id = p_request_id
    )
  then
    raise exception using errcode = '55000', message = 'payment request portions are inconsistent';
  end if;

  update public.payment_requests
  set status = p_status,
    paid_on = case when p_status = 'paid' then p_occurred_on else null end,
    cancelled_on = case when p_status = 'cancelled' then p_occurred_on else null end,
    forgiven_on = case when p_status = 'forgiven' then p_occurred_on else null end
  where user_id = owner_id and id = p_request_id;
end;
$$;

revoke all on function public.transition_payment_request(
  uuid, text, bigint, date
) from public;
grant execute on function public.transition_payment_request(
  uuid, text, bigint, date
) to authenticated;
