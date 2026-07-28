begin;

select plan(19);

select has_table('public', 'transactions', 'personal transactions table exists');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'expense-a@example.test', '',
    now(), now(), now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'expense-b@example.test', '',
    now(), now(), now()
  );

insert into public.categories (id, user_id, name, type)
values
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    '33333333-3333-4333-8333-333333333333',
    'Food',
    'expense'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    '44444444-4444-4444-8444-444444444444',
    'Transport',
    'expense'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    '33333333-3333-4333-8333-333333333333',
    'Salary',
    'income'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);

select lives_ok(
  $$
    insert into public.transactions (
      id, user_id, description, merchant, amount_sen, transaction_date,
      recorded_at, category_id, payment_method, notes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      '33333333-3333-4333-8333-333333333333',
      'Backdated lunch', 'Kopitiam', 1250, '2026-06-30', '2000-01-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'tng', 'Forgotten yesterday'
    )
  $$,
  'owner can create a personal transaction'
);

select results_eq(
  $$
    select description, merchant, amount_sen, transaction_date,
      payment_method, notes, transaction_type
    from public.transactions
  $$,
  $$
    values (
      'Backdated lunch'::text, 'Kopitiam'::text, 1250::bigint,
      '2026-06-30'::date, 'tng'::text, 'Forgotten yesterday'::text,
      'personal_expense'::text
    )
  $$,
  'owner reads exact personal transaction values'
);

select ok(
  (
    select recorded_at::date > transaction_date
    from public.transactions
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  ),
  'recorded time is stored separately from a backdated transaction date'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '44444444-4444-4444-8444-444444444444',
      'Stolen', 1, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'cash'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "transactions"',
  'owner cannot create a transaction for another user'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'Wrong category owner', 1, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'cash'
    )
  $$,
  '23503',
  null,
  'a transaction cannot use another owner category'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'Wrong category type', 1, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'cash'
    )
  $$,
  '23503',
  null,
  'a personal transaction requires an expense category'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'Zero', 0, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cash'
    )
  $$,
  '23514',
  null,
  'transactions reject zero amounts'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'Unsafe', 9007199254740992, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cash'
    )
  $$,
  '23514',
  null,
  'transactions reject amounts above Number.MAX_SAFE_INTEGER'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      ' ', 1, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'cash'
    )
  $$,
  '23514',
  null,
  'transactions reject blank descriptions'
);

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      category_id, payment_method
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'Card', 1, '2026-07-01',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'card'
    )
  $$,
  '23514',
  null,
  'transactions reject unsupported payment methods'
);

select lives_ok(
  $$
    update public.transactions
    set amount_sen = 1400, payment_method = 'cash'
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  $$,
  'owner can update a personal transaction'
);

select results_eq(
  $$
    select amount_sen, payment_method
    from public.transactions
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  $$,
  $$ values (1400::bigint, 'cash'::text) $$,
  'owner update persists exact personal transaction values'
);

update public.transactions
set recorded_at = '2000-01-01'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

select ok(
  (
    select recorded_at::date > transaction_date
    from public.transactions
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  ),
  'owner updates cannot rewrite the recorded audit time'
);

select set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);

select is(
  (select count(*) from public.transactions),
  0::bigint,
  'another user cannot read the owner transaction'
);

select is_empty(
  $$
    update public.transactions
    set amount_sen = 1
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    returning id
  $$,
  'another user cannot update the owner transaction'
);

select is_empty(
  $$
    delete from public.transactions
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    returning id
  $$,
  'another user cannot delete the owner transaction'
);

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);

select lives_ok(
  $$
    delete from public.transactions
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  $$,
  'owner can delete a personal transaction'
);

select is(
  (select count(*) from public.transactions),
  0::bigint,
  'owner transaction is deleted'
);

select * from finish();

rollback;
