begin;

select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '41414141-4141-4141-8141-414141414141',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-payments@example.test', '',
    now(), now(), now()
  ),
  (
    '42424242-4242-4242-8242-424242424242',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other-payments@example.test', '',
    now(), now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '41414141-4141-4141-8141-414141414141',
  true
);

insert into public.friends (id, user_id, name)
values (
  '43434343-4343-4343-8343-434343434343',
  '41414141-4141-4141-8141-414141414141',
  'Alex'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '41414141-4141-4141-8141-414141414141',
    'Dinner', 12480, '2026-07-10',
    'tng', 'shared_expense', 'unresolved'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '41414141-4141-4141-8141-414141414141',
    'Movie', 3600, '2026-07-14',
    'cash', 'shared_expense', 'unresolved'
  ),
  (
    '44444444-4444-4444-8444-444444444443',
    '41414141-4141-4141-8141-414141414141',
    'Coffee', 1000, '2026-07-16',
    'cash', 'shared_expense', 'unresolved'
  );

select public.save_equal_shared_bill_resolution(
  '44444444-4444-4444-8444-444444444441',
  '43434343-4343-4343-8343-434343434343',
  '45454545-4545-4545-8545-454545454541',
  md5('44444444-4444-4444-8444-444444444441:user')::uuid,
  '43434343-4343-4343-8343-434343434343',
  'Dinner',
  6240,
  6240
);
select public.save_equal_shared_bill_resolution(
  '44444444-4444-4444-8444-444444444442',
  '43434343-4343-4343-8343-434343434343',
  '45454545-4545-4545-8545-454545454542',
  md5('44444444-4444-4444-8444-444444444442:user')::uuid,
  '43434343-4343-4343-8343-434343434343',
  'Movie',
  1800,
  1800
);
select public.save_equal_shared_bill_resolution(
  '44444444-4444-4444-8444-444444444443',
  '43434343-4343-4343-8343-434343434343',
  '45454545-4545-4545-8545-454545454543',
  md5('44444444-4444-4444-8444-444444444443:user')::uuid,
  '43434343-4343-4343-8343-434343434343',
  'Coffee',
  500,
  500
);

select lives_ok(
  $$
    select public.create_payment_request(
      '43434343-4343-4343-8343-434343434343',
      array(
        select id
        from public.friend_portion_settlements
        where transaction_id in (
          '44444444-4444-4444-8444-444444444441',
          '44444444-4444-4444-8444-444444444442'
        )
        order by transaction_id
      ),
      '2026-07-18',
      'July expenses'
    )
  $$,
  'owner can create one lump-sum request'
);

select results_eq(
  $$
    select total_sen, request_date, status, note
    from public.payment_requests
  $$,
  $$ values (8040::bigint, '2026-07-18'::date, 'pending'::text, 'July expenses'::text) $$,
  'request stores the exact selected total'
);

select results_eq(
  $$
    select description_snapshot, transaction_date_snapshot, amount_sen_snapshot
    from public.payment_request_items
    order by transaction_date_snapshot
  $$,
  $$
    values
      ('Dinner'::text, '2026-07-10'::date, 6240::bigint),
      ('Movie'::text, '2026-07-14'::date, 1800::bigint)
  $$,
  'request items snapshot description, date, and amount'
);

select results_eq(
  $$
    select status, count(*)
    from public.friend_portion_settlements
    where transaction_id in (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
    group by status
  $$,
  $$ values ('requested'::text, 2::bigint) $$,
  'included portions are locked as requested'
);

select throws_ok(
  $$
    select public.create_payment_request(
      '43434343-4343-4343-8343-434343434343',
      array(
        select id
        from public.friend_portion_settlements
        where transaction_id = '44444444-4444-4444-8444-444444444441'
      ),
      '2026-07-19',
      null
    )
  $$,
  '55000',
  'one or more portions are not available to request',
  'a portion cannot be included in a second active request'
);

select throws_ok(
  $$
    update public.payment_request_items
    set amount_sen_snapshot = 1
  $$,
  '42501',
  null,
  'request snapshots cannot be directly updated'
);

select throws_ok(
  $$
    select public.transition_payment_request(
      (select id from public.payment_requests where total_sen = 8040),
      'paid',
      8000,
      '2026-07-22'
    )
  $$,
  '22023',
  'payment must match the full requested amount',
  'partial payment is rejected'
);

select is(
  (select status from public.payment_requests where total_sen = 8040),
  'pending'::text,
  'a rejected partial payment leaves the request pending'
);

select lives_ok(
  $$
    select public.transition_payment_request(
      (select id from public.payment_requests where total_sen = 8040),
      'paid',
      8040,
      '2026-07-22'
    )
  $$,
  'the exact full amount settles a pending request'
);

select results_eq(
  $$
    select status, paid_on
    from public.payment_requests
    where total_sen = 8040
  $$,
  $$ values ('paid'::text, '2026-07-22'::date) $$,
  'paid transition records its settlement date'
);

select results_eq(
  $$
    select status, settled_on, count(*)
    from public.friend_portion_settlements
    where transaction_id in (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
    group by status, settled_on
  $$,
  $$ values ('paid'::text, '2026-07-22'::date, 2::bigint) $$,
  'all requested portions settle together'
);

select is(
  (
    select count(*)
    from public.financial_plan_entries
    where entry_type = 'income'
  ),
  0::bigint,
  'repayment settlement does not create income'
);

select throws_ok(
  $$
    select public.transition_payment_request(
      (select id from public.payment_requests where total_sen = 8040),
      'cancelled',
      null,
      '2026-07-23'
    )
  $$,
  '55000',
  'payment request is already settled',
  'a terminal request cannot transition again'
);

select lives_ok(
  $$
    select public.create_payment_request(
      '43434343-4343-4343-8343-434343434343',
      array(
        select id
        from public.friend_portion_settlements
        where transaction_id = '44444444-4444-4444-8444-444444444443'
      ),
      '2026-07-19',
      null
    )
  $$,
  'a later unrequested bill can form another request'
);

select lives_ok(
  $$
    select public.transition_payment_request(
      (select id from public.payment_requests where total_sen = 500),
      'cancelled',
      null,
      '2026-07-20'
    )
  $$,
  'a pending request can be cancelled'
);

select results_eq(
  $$
    select status, payment_request_id, settled_on
    from public.friend_portion_settlements
    where transaction_id = '44444444-4444-4444-8444-444444444443'
  $$,
  $$ values ('unrequested'::text, null::uuid, null::date) $$,
  'cancellation unlocks the included portion'
);

select lives_ok(
  $$
    select public.create_payment_request(
      '43434343-4343-4343-8343-434343434343',
      array(
        select id
        from public.friend_portion_settlements
        where transaction_id = '44444444-4444-4444-8444-444444444443'
      ),
      '2026-07-21',
      null
    )
  $$,
  'a cancelled portion can be requested again'
);

select lives_ok(
  $$
    select public.transition_payment_request(
      (
        select id from public.payment_requests
        where total_sen = 500 and status = 'pending'
      ),
      'forgiven',
      null,
      '2026-07-22'
    )
  $$,
  'a pending request can be forgiven'
);

select results_eq(
  $$
    select status, settled_on
    from public.friend_portion_settlements
    where transaction_id = '44444444-4444-4444-8444-444444444443'
  $$,
  $$ values ('forgiven'::text, '2026-07-22'::date) $$,
  'forgiveness removes the portion from outstanding'
);

select is(
  (
    select sum(amount_sen_snapshot)
    from public.payment_request_items
    where payment_request_id = (
      select id from public.payment_requests where total_sen = 8040
    )
  ),
  8040::numeric,
  'later bills and transitions never change the original snapshots'
);

set local role postgres;
select lives_ok(
  $$
    delete from public.payment_requests
    where status = 'cancelled'
  $$,
  'trusted parent cleanup can cascade through immutable snapshots'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '41414141-4141-4141-8141-414141414141',
  true
);

create temporary table owner_payment_request_ids (
  id uuid primary key
) on commit drop;
insert into owner_payment_request_ids (id)
select id
from public.payment_requests
where total_sen = 8040;

select set_config(
  'request.jwt.claim.sub',
  '42424242-4242-4242-8242-424242424242',
  true
);

select is(
  (select count(*) from public.payment_requests),
  0::bigint,
  'another user cannot read payment requests'
);
select is(
  (select count(*) from public.payment_request_items),
  0::bigint,
  'another user cannot read request snapshots'
);
select is(
  (select count(*) from public.friend_portion_settlements),
  0::bigint,
  'another user cannot read portion settlement state'
);

select throws_ok(
  $$
    select public.transition_payment_request(
      (select id from owner_payment_request_ids),
      'paid',
      8040,
      '2026-07-22'
    )
  $$,
  '42501',
  'payment request not found',
  'another user cannot transition an owner request'
);

select * from finish();

rollback;
