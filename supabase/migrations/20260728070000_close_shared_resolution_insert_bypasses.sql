alter table public.item_assignments
drop constraint item_assignments_participant_fkey;

alter table public.bill_participants
drop constraint bill_participants_pkey;

create temporary table shared_bill_participant_identity_map
on commit drop
as
select
  user_id,
  transaction_id,
  id as old_id,
  case
    when participant_kind = 'user'
      then md5(transaction_id::text || ':user')::uuid
    else friend_id
  end as new_id
from public.bill_participants;

alter table public.bill_participants disable trigger user;

update public.bill_participants as participant
set id = identity_map.new_id
from shared_bill_participant_identity_map as identity_map
where participant.user_id = identity_map.user_id
  and participant.transaction_id = identity_map.transaction_id
  and participant.id = identity_map.old_id;

alter table public.bill_participants enable trigger user;

update public.item_assignments as assignment
set participant_id = identity_map.new_id
from shared_bill_participant_identity_map as identity_map
where assignment.user_id = identity_map.user_id
  and assignment.transaction_id = identity_map.transaction_id
  and assignment.participant_id = identity_map.old_id;

alter table public.bill_participants
add constraint bill_participants_pkey primary key (transaction_id, id),
add constraint bill_participants_identity_check check (
  (
    participant_kind = 'user'
    and id = md5(transaction_id::text || ':user')::uuid
  )
  or
  (
    participant_kind = 'friend'
    and id = friend_id
  )
);

alter table public.item_assignments
add constraint item_assignments_participant_fkey
foreign key (user_id, transaction_id, participant_id)
references public.bill_participants (user_id, transaction_id, id)
on delete cascade;

create or replace function public.prevent_resolved_shared_bill_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.transaction_type = 'shared_expense'
      and new.shared_status = 'resolved'
    then
      raise exception using
        errcode = '55000',
        message = 'shared bills may only resolve through validated allocation';
    end if;
    return new;
  end if;

  if old.transaction_type = 'shared_expense'
    and old.shared_status = 'resolved'
  then
    raise exception using
      errcode = '55000',
      message = 'resolved shared bills are immutable';
  end if;

  if tg_op = 'UPDATE'
    and new.transaction_type = 'shared_expense'
    and new.shared_status = 'resolved'
    and not (
      old.transaction_type = 'shared_expense'
      and old.shared_status = 'unresolved'
      and current_user = 'postgres'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'shared bills may only resolve through validated allocation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger transactions_prevent_resolved_shared_bill_change
on public.transactions;

create trigger transactions_prevent_resolved_shared_bill_change
before insert or update or delete on public.transactions
for each row execute function public.prevent_resolved_shared_bill_change();
