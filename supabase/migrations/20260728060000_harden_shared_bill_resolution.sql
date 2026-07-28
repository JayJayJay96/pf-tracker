alter table public.bill_items
add column sort_order integer not null default 0,
add constraint bill_items_sort_order_check check (sort_order >= 0);

alter table public.bill_adjustments
add column sort_order integer not null default 0,
drop constraint bill_adjustments_amount_check,
add constraint bill_adjustments_amount_check check (
  amount_sen between -9007199254740991 and 9007199254740991
  and (adjustment_kind = 'rounding' or amount_sen >= 0)
),
add constraint bill_adjustments_sort_order_check check (sort_order >= 0);

create or replace function public.prevent_resolved_shared_bill_change()
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

  if tg_op = 'UPDATE'
    and old.transaction_type = 'shared_expense'
    and old.shared_status = 'unresolved'
    and new.shared_status = 'resolved'
    and current_user <> 'postgres'
  then
    raise exception using
      errcode = '55000',
      message = 'shared bills may only resolve through validated allocation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.prevent_resolved_allocation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_transaction_id uuid :=
    case when tg_op in ('UPDATE', 'DELETE') then old.transaction_id else null end;
  new_transaction_id uuid :=
    case when tg_op in ('INSERT', 'UPDATE') then new.transaction_id else null end;
begin
  if exists (
    select 1
    from public.transactions
    where id in (old_transaction_id, new_transaction_id)
      and shared_status = 'resolved'
  ) then
    raise exception using
      errcode = '55000',
      message = 'resolved shared bill allocations are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.resolve_shared_bill(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  transaction_total bigint;
  user_participant_id uuid;
  participant_count bigint;
  assignment_count bigint;
  magnitude_sen bigint;
  direction integer;
  weight_total numeric;
  allocated_total numeric;
  residual_sen bigint;
  residual_recipient uuid;
  computed_total numeric;
  manual_total numeric;
  item_row record;
  adjustment_row record;
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

  create temporary table if not exists pg_temp.shared_bill_computed_portions (
    participant_id uuid primary key,
    participant_kind text not null,
    amount_sen bigint not null
  ) on commit drop;
  create temporary table if not exists pg_temp.shared_bill_eligible (
    participant_id uuid primary key,
    weight_sen bigint not null,
    share_sen bigint not null default 0
  ) on commit drop;
  truncate pg_temp.shared_bill_computed_portions;
  truncate pg_temp.shared_bill_eligible;

  insert into pg_temp.shared_bill_computed_portions (
    participant_id, participant_kind, amount_sen
  )
  select id, participant_kind, 0
  from public.bill_participants
  where user_id = owner_id
    and transaction_id = p_transaction_id;

  select count(*),
    (
      array_agg(participant_id order by participant_id)
      filter (where participant_kind = 'user')
    )[1]
  into participant_count, user_participant_id
  from pg_temp.shared_bill_computed_portions;

  if participant_count = 0 or (
    select count(*)
    from pg_temp.shared_bill_computed_portions
    where participant_kind = 'user'
  ) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'bill must have exactly one user participant';
  end if;

  for item_row in
    select id, amount_sen, discount_sen
    from public.bill_items
    where user_id = owner_id
      and transaction_id = p_transaction_id
    order by sort_order, id
  loop
    truncate pg_temp.shared_bill_eligible;
    insert into pg_temp.shared_bill_eligible (participant_id, weight_sen)
    select participant_id, 1
    from public.item_assignments
    where user_id = owner_id
      and transaction_id = p_transaction_id
      and item_id = item_row.id;

    get diagnostics assignment_count = row_count;
    if assignment_count = 0 then
      raise exception using
        errcode = '23514',
        message = 'every bill item must have an assignment';
    end if;

    update pg_temp.shared_bill_eligible
    set share_sen = item_row.amount_sen / assignment_count
    where true;
    residual_sen := item_row.amount_sen % assignment_count;
    select case
      when exists (
        select 1 from pg_temp.shared_bill_eligible
        where participant_id = user_participant_id
      ) then user_participant_id
      else (array_agg(participant_id order by participant_id))[1]
    end
    into residual_recipient
    from pg_temp.shared_bill_eligible;
    update pg_temp.shared_bill_eligible
    set share_sen = share_sen + residual_sen
    where participant_id = residual_recipient;
    update pg_temp.shared_bill_computed_portions as portions
    set amount_sen = portions.amount_sen + eligible.share_sen
    from pg_temp.shared_bill_eligible as eligible
    where portions.participant_id = eligible.participant_id;

    update pg_temp.shared_bill_eligible
    set share_sen = item_row.discount_sen / assignment_count
    where true;
    residual_sen := item_row.discount_sen % assignment_count;
    update pg_temp.shared_bill_eligible
    set share_sen = share_sen + residual_sen
    where participant_id = residual_recipient;
    update pg_temp.shared_bill_computed_portions as portions
    set amount_sen = portions.amount_sen - eligible.share_sen
    from pg_temp.shared_bill_eligible as eligible
    where portions.participant_id = eligible.participant_id;
  end loop;

  if not exists (
    select 1
    from public.bill_items
    where user_id = owner_id
      and transaction_id = p_transaction_id
  ) then
    raise exception using errcode = '23514', message = 'bill must have an item';
  end if;

  for adjustment_row in
    select id, adjustment_kind, amount_sen, distribution_method, allocation
    from public.bill_adjustments
    where user_id = owner_id
      and transaction_id = p_transaction_id
    order by
      case adjustment_kind
        when 'discount' then 0
        when 'service' then 1
        when 'tax' then 2
        else 3
      end,
      sort_order,
      id
  loop
    truncate pg_temp.shared_bill_eligible;
    magnitude_sen := abs(adjustment_row.amount_sen);
    direction := case
      when adjustment_row.adjustment_kind = 'discount' then -1
      when adjustment_row.adjustment_kind = 'rounding'
        and adjustment_row.amount_sen < 0 then -1
      else 1
    end;

    if adjustment_row.distribution_method = 'proportional' then
      insert into pg_temp.shared_bill_eligible (participant_id, weight_sen)
      select participant_id, amount_sen
      from pg_temp.shared_bill_computed_portions;
    elsif adjustment_row.distribution_method = 'user' then
      insert into pg_temp.shared_bill_eligible (participant_id, weight_sen)
      values (user_participant_id, 1);
    elsif adjustment_row.distribution_method in ('equal', 'selected') then
      if adjustment_row.distribution_method = 'equal'
        and not (adjustment_row.allocation ? 'participantIds')
      then
        insert into pg_temp.shared_bill_eligible (participant_id, weight_sen)
        select participant_id, 1
        from pg_temp.shared_bill_computed_portions;
      else
        if jsonb_typeof(adjustment_row.allocation -> 'participantIds') <> 'array'
          or jsonb_array_length(adjustment_row.allocation -> 'participantIds') = 0
          or (
            select count(*)
            from jsonb_array_elements_text(
              adjustment_row.allocation -> 'participantIds'
            )
          ) <> (
            select count(distinct value)
            from jsonb_array_elements_text(
              adjustment_row.allocation -> 'participantIds'
            )
          )
        then
          raise exception using
            errcode = '23514',
            message = 'adjustment participants must be unique and nonempty';
        end if;

        insert into pg_temp.shared_bill_eligible (participant_id, weight_sen)
        select portions.participant_id, 1
        from jsonb_array_elements_text(
          adjustment_row.allocation -> 'participantIds'
        ) as selected(value)
        join pg_temp.shared_bill_computed_portions as portions
          on portions.participant_id = selected.value::uuid;

        if (
          select count(*) from pg_temp.shared_bill_eligible
        ) <> jsonb_array_length(adjustment_row.allocation -> 'participantIds') then
          raise exception using
            errcode = '23514',
            message = 'adjustment names an unknown participant';
        end if;
      end if;
    elsif adjustment_row.distribution_method = 'manual' then
      if jsonb_typeof(adjustment_row.allocation -> 'amountsSen') <> 'object' then
        raise exception using
          errcode = '23514',
          message = 'manual allocation must contain amountsSen';
      end if;
      insert into pg_temp.shared_bill_eligible (
        participant_id, weight_sen, share_sen
      )
      select portions.participant_id, 0, manual.value::bigint
      from jsonb_each_text(
        adjustment_row.allocation -> 'amountsSen'
      ) as manual(key, value)
      join pg_temp.shared_bill_computed_portions as portions
        on portions.participant_id = manual.key::uuid;
      select coalesce(sum(share_sen), 0)
      into manual_total
      from pg_temp.shared_bill_eligible;
      if manual_total <> magnitude_sen
        or exists (
          select 1 from pg_temp.shared_bill_eligible where share_sen < 0
        )
        or (
          select count(*) from pg_temp.shared_bill_eligible
        ) <> (
          select count(*)
          from jsonb_each(adjustment_row.allocation -> 'amountsSen')
        )
      then
        raise exception using
          errcode = '23514',
          message = 'manual allocation does not match adjustment amount';
      end if;
      update pg_temp.shared_bill_computed_portions as portions
      set amount_sen = portions.amount_sen + direction * eligible.share_sen
      from pg_temp.shared_bill_eligible as eligible
      where portions.participant_id = eligible.participant_id;
      if exists (
        select 1 from pg_temp.shared_bill_computed_portions where amount_sen < 0
      ) then
        raise exception using
          errcode = '23514',
          message = 'adjustment makes a participant portion negative';
      end if;
      continue;
    else
      raise exception using
        errcode = '23514',
        message = 'unsupported adjustment distribution';
    end if;

    select sum(weight_sen)
    into weight_total
    from pg_temp.shared_bill_eligible;
    if weight_total <= 0 then
      raise exception using
        errcode = '23514',
        message = 'adjustment has no positive allocation weight';
    end if;
    update pg_temp.shared_bill_eligible
    set share_sen = floor(
      magnitude_sen::numeric * weight_sen::numeric / weight_total
    )::bigint
    where true;
    select sum(share_sen)
    into allocated_total
    from pg_temp.shared_bill_eligible;
    residual_sen := magnitude_sen - allocated_total::bigint;
    select case
      when exists (
        select 1 from pg_temp.shared_bill_eligible
        where participant_id = user_participant_id
      ) then user_participant_id
      else (array_agg(participant_id order by participant_id))[1]
    end
    into residual_recipient
    from pg_temp.shared_bill_eligible;
    update pg_temp.shared_bill_eligible
    set share_sen = share_sen + residual_sen
    where participant_id = residual_recipient;
    update pg_temp.shared_bill_computed_portions as portions
    set amount_sen = portions.amount_sen + direction * eligible.share_sen
    from pg_temp.shared_bill_eligible as eligible
    where portions.participant_id = eligible.participant_id;

    if exists (
      select 1 from pg_temp.shared_bill_computed_portions where amount_sen < 0
    ) then
      raise exception using
        errcode = '23514',
        message = 'adjustment makes a participant portion negative';
    end if;
  end loop;

  select sum(amount_sen)
  into computed_total
  from pg_temp.shared_bill_computed_portions;
  if computed_total <> transaction_total then
    raise exception using
      errcode = '23514',
      message = 'bill items and adjustments do not reconcile to transaction total';
  end if;

  if exists (
    select 1
    from pg_temp.shared_bill_computed_portions as computed
    full join (
      select id, amount_sen
      from public.bill_participants
      where user_id = owner_id
        and transaction_id = p_transaction_id
    ) as saved
      on saved.id = computed.participant_id
    where computed.participant_id is null
      or saved.id is null
      or computed.amount_sen <> saved.amount_sen
  ) then
    raise exception using
      errcode = '23514',
      message = 'saved participant portions do not match computed allocation';
  end if;

  update public.transactions
  set shared_status = 'resolved',
    resolved_at = clock_timestamp()
  where id = p_transaction_id
    and user_id = owner_id;
end;
$$;

create function public.save_shared_bill_resolution(
  p_transaction_id uuid,
  p_items jsonb,
  p_participants jsonb,
  p_assignments jsonb,
  p_adjustments jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if not exists (
    select 1
    from public.transactions
    where id = p_transaction_id
      and user_id = owner_id
      and transaction_type = 'shared_expense'
      and shared_status = 'unresolved'
    for update
  ) then
    raise exception using errcode = 'P0002', message = 'unresolved shared bill not found';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_typeof(p_participants) <> 'array'
    or jsonb_typeof(p_assignments) <> 'array'
    or jsonb_typeof(p_adjustments) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid allocation payload';
  end if;

  delete from public.item_assignments
  where user_id = owner_id and transaction_id = p_transaction_id;
  delete from public.bill_adjustments
  where user_id = owner_id and transaction_id = p_transaction_id;
  delete from public.bill_items
  where user_id = owner_id and transaction_id = p_transaction_id;
  delete from public.bill_participants
  where user_id = owner_id and transaction_id = p_transaction_id;

  insert into public.bill_items (
    id, user_id, transaction_id, description, amount_sen, discount_sen,
    sort_order
  )
  select
    item.id, owner_id, p_transaction_id, item.description,
    item.amount_sen, item.discount_sen, item.sort_order
  from jsonb_to_recordset(p_items) as item(
    id uuid,
    description text,
    amount_sen bigint,
    discount_sen bigint,
    sort_order integer
  );

  insert into public.bill_participants (
    id, user_id, transaction_id, participant_kind, friend_id, amount_sen
  )
  select
    participant.id, owner_id, p_transaction_id,
    participant.participant_kind, participant.friend_id,
    participant.amount_sen
  from jsonb_to_recordset(p_participants) as participant(
    id uuid,
    participant_kind text,
    friend_id uuid,
    amount_sen bigint
  );

  insert into public.item_assignments (
    user_id, transaction_id, item_id, participant_id
  )
  select
    owner_id, p_transaction_id, assignment.item_id,
    assignment.participant_id
  from jsonb_to_recordset(p_assignments) as assignment(
    item_id uuid,
    participant_id uuid
  );

  insert into public.bill_adjustments (
    id, user_id, transaction_id, adjustment_kind, amount_sen,
    distribution_method, allocation, sort_order
  )
  select
    adjustment.id, owner_id, p_transaction_id,
    adjustment.adjustment_kind, adjustment.amount_sen,
    adjustment.distribution_method, adjustment.allocation,
    adjustment.sort_order
  from jsonb_to_recordset(p_adjustments) as adjustment(
    id uuid,
    adjustment_kind text,
    amount_sen bigint,
    distribution_method text,
    allocation jsonb,
    sort_order integer
  );

  perform public.resolve_shared_bill(p_transaction_id);
end;
$$;

revoke all on function public.save_shared_bill_resolution(
  uuid, jsonb, jsonb, jsonb, jsonb
) from public;
grant execute on function public.save_shared_bill_resolution(
  uuid, jsonb, jsonb, jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';
