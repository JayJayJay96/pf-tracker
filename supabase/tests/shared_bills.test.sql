begin;

select plan(29);

select has_table('public', 'friends', 'friends table exists');
select has_table('public', 'bill_items', 'bill items table exists');
select has_table('public', 'bill_participants', 'bill participants table exists');
select has_table('public', 'item_assignments', 'item assignments table exists');
select has_table('public', 'bill_adjustments', 'bill adjustments table exists');

select has_column('public', 'friends', 'user_id', 'friends carry direct ownership');
select has_column('public', 'bill_items', 'user_id', 'bill items carry direct ownership');
select has_column('public', 'bill_participants', 'user_id', 'participants carry direct ownership');
select has_column('public', 'item_assignments', 'user_id', 'assignments carry direct ownership');
select has_column('public', 'bill_adjustments', 'user_id', 'adjustments carry direct ownership');

select is(
  (
    select count(*)
    from pg_class
    where oid in (
      'public.friends'::regclass,
      'public.bill_items'::regclass,
      'public.bill_participants'::regclass,
      'public.item_assignments'::regclass,
      'public.bill_adjustments'::regclass
    )
      and relrowsecurity
  ),
  5::bigint,
  'every shared-bill child table has RLS enabled'
);
select is(
  (
    select prosecdef
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'save_equal_shared_bill_resolution'
  ),
  true,
  'equal resolution uses one controlled atomic database function'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'bill-a@example.test', '',
    now(), now(), now()
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'bill-b@example.test', '',
    now(), now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '55555555-5555-4555-8555-555555555555',
  true
);

select lives_ok(
  $$
    insert into public.friends (id, user_id, name)
    values (
      '77777777-7777-4777-8777-777777777777',
      '55555555-5555-4555-8555-555555555555',
      'Alex'
    )
  $$,
  'owner can create a friend'
);

select throws_ok(
  $$
    insert into public.friends (user_id, name)
    values ('66666666-6666-4666-8666-666666666666', 'Stolen')
  $$,
  '42501',
  'new row violates row-level security policy for table "friends"',
  'owner cannot create another user friend'
);

select lives_ok(
  $$
    insert into public.transactions (
      id, user_id, description, amount_sen, transaction_date,
      payment_method, transaction_type, shared_status
    )
    values (
      '88888888-8888-4888-8888-888888888888',
      '55555555-5555-4555-8555-555555555555',
      'Shared dinner', 1000, '2026-07-01',
      'tng', 'shared_expense', 'unresolved'
    )
  $$,
  'owner can record an unresolved shared cash outflow'
);

select results_eq(
  $$
    select amount_sen, shared_status
    from public.transactions
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  $$ values (1000::bigint, 'unresolved'::text) $$,
  'unresolved bill preserves its full cash outflow'
);

select lives_ok(
  $$
    insert into public.bill_items (
      id, user_id, transaction_id, description, amount_sen, discount_sen
    )
    values (
      '99999999-9999-4999-8999-999999999999',
      '55555555-5555-4555-8555-555555555555',
      '88888888-8888-4888-8888-888888888888',
      'Food', 1200, 100
    );

    insert into public.bill_participants (
      id, user_id, transaction_id, participant_kind, friend_id, amount_sen
    )
    values
      (
        md5('88888888-8888-4888-8888-888888888888:user')::uuid,
        '55555555-5555-4555-8555-555555555555',
        '88888888-8888-4888-8888-888888888888',
        'user', null, 500
      ),
      (
        '77777777-7777-4777-8777-777777777777',
        '55555555-5555-4555-8555-555555555555',
        '88888888-8888-4888-8888-888888888888',
        'friend', '77777777-7777-4777-8777-777777777777', 500
      );

    insert into public.item_assignments (
      user_id, transaction_id, item_id, participant_id
    )
    values
      (
        '55555555-5555-4555-8555-555555555555',
        '88888888-8888-4888-8888-888888888888',
        '99999999-9999-4999-8999-999999999999',
        md5('88888888-8888-4888-8888-888888888888:user')::uuid
      ),
      (
        '55555555-5555-4555-8555-555555555555',
        '88888888-8888-4888-8888-888888888888',
        '99999999-9999-4999-8999-999999999999',
        '77777777-7777-4777-8777-777777777777'
      );

    insert into public.bill_adjustments (
      user_id, transaction_id, adjustment_kind, amount_sen,
      distribution_method, allocation
    )
    values (
      '55555555-5555-4555-8555-555555555555',
      '88888888-8888-4888-8888-888888888888',
      'discount', 100, 'proportional', '{}'::jsonb
    )
  $$,
  'owner can store items, participants, assignments, and adjustments'
);

select throws_ok(
  $$
    insert into public.bill_items (
      user_id, transaction_id, description, amount_sen
    )
    values (
      '66666666-6666-4666-8666-666666666666',
      '88888888-8888-4888-8888-888888888888',
      'Cross owner', 1
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "bill_items"',
  'RLS rejects cross-owner child insertion'
);

select lives_ok(
  $$ select public.resolve_shared_bill('88888888-8888-4888-8888-888888888888') $$,
  'a bill resolves only after exact item and participant reconciliation'
);

select results_eq(
  $$
    select shared_status, resolved_at is not null
    from public.transactions
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  $$ values ('resolved'::text, true) $$,
  'resolution records immutable resolved state'
);

select is(
  (
    select sum(amount_sen)
    from public.bill_participants
    where transaction_id = '88888888-8888-4888-8888-888888888888'
  ),
  1000::numeric,
  'saved participant portions reconcile to the transaction exactly'
);

select throws_ok(
  $$
    update public.transactions
    set amount_sen = 999
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  '55000',
  'resolved shared bills are immutable',
  'resolved transaction values cannot be rewritten'
);

select throws_ok(
  $$
    update public.bill_participants
    set amount_sen = 399
    where id = '77777777-7777-4777-8777-777777777777'
  $$,
  '55000',
  'resolved shared bill allocations are immutable',
  'resolved participant portions cannot be rewritten'
);

select throws_ok(
  $$
    delete from public.bill_items
    where id = '99999999-9999-4999-8999-999999999999'
  $$,
  '55000',
  'resolved shared bill allocations are immutable',
  'resolved item values cannot be deleted'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  'bbbbbbbb-8888-4888-8888-888888888888',
  '55555555-5555-4555-8555-555555555555',
  'Bad total', 999, '2026-07-02',
  'cash', 'shared_expense', 'unresolved'
);
insert into public.bill_items (
  user_id, transaction_id, description, amount_sen
)
values (
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-8888-4888-8888-888888888888',
  'Food', 1000
);
insert into public.bill_participants (
  id, user_id, transaction_id, participant_kind, amount_sen
)
values (
  md5('bbbbbbbb-8888-4888-8888-888888888888:user')::uuid,
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-8888-4888-8888-888888888888',
  'user', 999
);
insert into public.item_assignments (
  user_id, transaction_id, item_id, participant_id
)
select
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-8888-4888-8888-888888888888',
  id,
  md5('bbbbbbbb-8888-4888-8888-888888888888:user')::uuid
from public.bill_items
where transaction_id = 'bbbbbbbb-8888-4888-8888-888888888888';

select throws_ok(
  $$ select public.resolve_shared_bill('bbbbbbbb-8888-4888-8888-888888888888') $$,
  '23514',
  'bill items and adjustments do not reconcile to transaction total',
  'resolution rejects an item-total mismatch'
);

select set_config(
  'request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666',
  true
);

select is(
  (select count(*) from public.transactions),
  0::bigint,
  'another user cannot read shared transactions'
);
select is(
  (select count(*) from public.friends),
  0::bigint,
  'another user cannot read friends'
);
select is(
  (select count(*) from public.bill_items),
  0::bigint,
  'another user cannot read bill items'
);
select is(
  (select count(*) from public.bill_participants),
  0::bigint,
  'another user cannot read receivable portions'
);

select * from finish();

rollback;
