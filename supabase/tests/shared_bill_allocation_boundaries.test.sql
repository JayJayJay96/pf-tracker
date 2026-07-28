begin;

select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values (
  '12121212-1212-4121-8121-121212121212',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'allocation@example.test', '',
  now(), now(), now()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12121212-1212-4121-8121-121212121212',
  true
);

insert into public.friends (id, user_id, name)
values
  (
    '13131313-1313-4131-8131-131313131313',
    '12121212-1212-4121-8121-121212121212',
    'Alex'
  ),
  (
    '30303030-3030-4303-8303-303030303030',
    '12121212-1212-4121-8121-121212121212',
    'Bee'
  );

select throws_ok(
  $$
    insert into public.transactions (
      user_id, description, amount_sen, transaction_date,
      payment_method, transaction_type, shared_status, resolved_at
    )
    values (
      '12121212-1212-4121-8121-121212121212',
      'Forged resolved insert', 100, '2026-07-01',
      'cash', 'shared_expense', 'resolved', now()
    )
  $$,
  '55000',
  'shared bills may only resolve through validated allocation',
  'a shared transaction cannot be inserted already resolved'
);

insert into public.categories (id, user_id, name, type)
values (
  '31313131-3131-4313-8313-313131313131',
  '12121212-1212-4121-8121-121212121212',
  'Food',
  'expense'
);
insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  category_id, payment_method
)
values (
  '32323232-3232-4323-8323-323232323232',
  '12121212-1212-4121-8121-121212121212',
  'Personal conversion target', 100, '2026-07-01',
  '31313131-3131-4313-8313-313131313131', 'cash'
);

select throws_ok(
  $$
    update public.transactions
    set transaction_type = 'shared_expense',
      category_id = null,
      shared_status = 'resolved',
      resolved_at = now()
    where id = '32323232-3232-4323-8323-323232323232'
  $$,
  '55000',
  'shared bills may only resolve through validated allocation',
  'a personal transaction cannot convert directly to resolved shared state'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  '14141414-1414-4141-8141-141414141414',
  '12121212-1212-4121-8121-121212121212',
  'Bypass target', 100, '2026-07-01',
  'cash', 'shared_expense', 'unresolved'
);

select throws_ok(
  $$
    update public.transactions
    set shared_status = 'resolved', resolved_at = now()
    where id = '14141414-1414-4141-8141-141414141414'
  $$,
  '55000',
  'shared bills may only resolve through validated allocation',
  'direct unresolved to resolved transition is rejected'
);

select throws_ok(
  $$
    insert into public.bill_participants (
      id, user_id, transaction_id, participant_kind, friend_id, amount_sen
    )
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '12121212-1212-4121-8121-121212121212',
      '14141414-1414-4141-8141-141414141414',
      'friend', '13131313-1313-4131-8131-131313131313', 0
    )
  $$,
  '23514',
  null,
  'participant row ids cannot be random or differ from participant identity'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  '15151515-1515-4151-8151-151515151515',
  '12121212-1212-4121-8121-121212121212',
  'Wrong portions', 1000, '2026-07-02',
  'cash', 'shared_expense', 'unresolved'
);
insert into public.bill_items (
  id, user_id, transaction_id, description, amount_sen
)
values
  (
    '16161616-1616-4161-8161-161616161611',
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    'User item', 500
  ),
  (
    '16161616-1616-4161-8161-161616161612',
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    'Friend item', 500
  );
insert into public.bill_participants (
  id, user_id, transaction_id, participant_kind, friend_id, amount_sen
)
values
  (
    md5('15151515-1515-4151-8151-151515151515:user')::uuid,
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    'user', null, 600
  ),
  (
    '13131313-1313-4131-8131-131313131313',
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    'friend', '13131313-1313-4131-8131-131313131313', 400
  );
insert into public.item_assignments (
  user_id, transaction_id, item_id, participant_id
)
values
  (
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    '16161616-1616-4161-8161-161616161611',
    md5('15151515-1515-4151-8151-151515151515:user')::uuid
  ),
  (
    '12121212-1212-4121-8121-121212121212',
    '15151515-1515-4151-8151-151515151515',
    '16161616-1616-4161-8161-161616161612',
    '13131313-1313-4131-8131-131313131313'
  );

select throws_ok(
  $$ select public.resolve_shared_bill('15151515-1515-4151-8151-151515151515') $$,
  '23514',
  'saved participant portions do not match computed allocation',
  '500/500 computed portions reject a forged 600/400 split'
);

select throws_ok(
  $$
    insert into public.item_assignments (
      user_id, transaction_id, item_id, participant_id
    )
    values (
      '12121212-1212-4121-8121-121212121212',
      '15151515-1515-4151-8151-151515151515',
      '16161616-1616-4161-8161-161616161611',
      md5('15151515-1515-4151-8151-151515151515:user')::uuid
    )
  $$,
  '23505',
  null,
  'database rejects a duplicate item participant'
);

select throws_ok(
  $$
    insert into public.item_assignments (
      user_id, transaction_id, item_id, participant_id
    )
    values (
      '12121212-1212-4121-8121-121212121212',
      '15151515-1515-4151-8151-151515151515',
      '16161616-1616-4161-8161-161616161611',
      '23232323-2323-4232-8232-232323232323'
    )
  $$,
  '23503',
  null,
  'database rejects an unknown item participant'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  '24242424-2424-4242-8242-242424242424',
  '12121212-1212-4121-8121-121212121212',
  'Wrong adjustment portions', 1100, '2026-07-02',
  'cash', 'shared_expense', 'unresolved'
);
insert into public.bill_items (
  id, user_id, transaction_id, description, amount_sen
)
values (
  '25252525-2525-4252-8252-252525252525',
  '12121212-1212-4121-8121-121212121212',
  '24242424-2424-4242-8242-242424242424',
  'Shared item', 1000
);
insert into public.bill_participants (
  id, user_id, transaction_id, participant_kind, friend_id, amount_sen
)
values
  (
    md5('24242424-2424-4242-8242-242424242424:user')::uuid,
    '12121212-1212-4121-8121-121212121212',
    '24242424-2424-4242-8242-242424242424',
    'user', null, 600
  ),
  (
    '13131313-1313-4131-8131-131313131313',
    '12121212-1212-4121-8121-121212121212',
    '24242424-2424-4242-8242-242424242424',
    'friend', '13131313-1313-4131-8131-131313131313', 500
  );
insert into public.item_assignments (
  user_id, transaction_id, item_id, participant_id
)
values
  (
    '12121212-1212-4121-8121-121212121212',
    '24242424-2424-4242-8242-242424242424',
    '25252525-2525-4252-8252-252525252525',
    md5('24242424-2424-4242-8242-242424242424:user')::uuid
  ),
  (
    '12121212-1212-4121-8121-121212121212',
    '24242424-2424-4242-8242-242424242424',
    '25252525-2525-4252-8252-252525252525',
    '13131313-1313-4131-8131-131313131313'
  );
insert into public.bill_adjustments (
  user_id, transaction_id, adjustment_kind, amount_sen,
  distribution_method
)
values (
  '12121212-1212-4121-8121-121212121212',
  '24242424-2424-4242-8242-242424242424',
  'service', 100, 'proportional'
);

select throws_ok(
  $$ select public.resolve_shared_bill('24242424-2424-4242-8242-242424242424') $$,
  '23514',
  'saved participant portions do not match computed allocation',
  'server recomputes proportional adjustments instead of trusting saved totals'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  '33333333-3333-4333-8333-333333333333',
  '12121212-1212-4121-8121-121212121212',
  'Friend residual', 1, '2026-07-02',
  'cash', 'shared_expense', 'unresolved'
);
insert into public.bill_items (
  id, user_id, transaction_id, description, amount_sen
)
values (
  '34343434-3434-4343-8343-343434343434',
  '12121212-1212-4121-8121-121212121212',
  '33333333-3333-4333-8333-333333333333',
  'Odd cent', 1
);
insert into public.bill_participants (
  id, user_id, transaction_id, participant_kind, friend_id, amount_sen
)
values
  (
    md5('33333333-3333-4333-8333-333333333333:user')::uuid,
    '12121212-1212-4121-8121-121212121212',
    '33333333-3333-4333-8333-333333333333',
    'user', null, 0
  ),
  (
    '13131313-1313-4131-8131-131313131313',
    '12121212-1212-4121-8121-121212121212',
    '33333333-3333-4333-8333-333333333333',
    'friend', '13131313-1313-4131-8131-131313131313', 1
  ),
  (
    '30303030-3030-4303-8303-303030303030',
    '12121212-1212-4121-8121-121212121212',
    '33333333-3333-4333-8333-333333333333',
    'friend', '30303030-3030-4303-8303-303030303030', 0
  );
insert into public.item_assignments (
  user_id, transaction_id, item_id, participant_id
)
values
  (
    '12121212-1212-4121-8121-121212121212',
    '33333333-3333-4333-8333-333333333333',
    '34343434-3434-4343-8343-343434343434',
    '13131313-1313-4131-8131-131313131313'
  ),
  (
    '12121212-1212-4121-8121-121212121212',
    '33333333-3333-4333-8333-333333333333',
    '34343434-3434-4343-8343-343434343434',
    '30303030-3030-4303-8303-303030303030'
  );

select lives_ok(
  $$ select public.resolve_shared_bill('33333333-3333-4333-8333-333333333333') $$,
  'multi-friend odd-cent resolution is independent of participant row ids'
);

select results_eq(
  $$
    select friend_id, amount_sen
    from public.bill_participants
    where transaction_id = '33333333-3333-4333-8333-333333333333'
      and participant_kind = 'friend'
    order by friend_id
  $$,
  $$
    values
      ('13131313-1313-4131-8131-131313131313'::uuid, 1::bigint),
      ('30303030-3030-4303-8303-303030303030'::uuid, 0::bigint)
  $$,
  'lowest friend UUID receives the residual when the user is not assigned'
);

insert into public.transactions (
  id, user_id, description, amount_sen, transaction_date,
  payment_method, transaction_type, shared_status
)
values (
  '18181818-1818-4181-8181-181818181818',
  '12121212-1212-4121-8121-121212121212',
  'Missing assignment', 100, '2026-07-03',
  'cash', 'shared_expense', 'unresolved'
);
insert into public.bill_items (
  user_id, transaction_id, description, amount_sen
)
values (
  '12121212-1212-4121-8121-121212121212',
  '18181818-1818-4181-8181-181818181818',
  'Unassigned', 100
);
insert into public.bill_participants (
  id, user_id, transaction_id, participant_kind, amount_sen
)
values (
  md5('18181818-1818-4181-8181-181818181818:user')::uuid,
  '12121212-1212-4121-8121-121212121212',
  '18181818-1818-4181-8181-181818181818',
  'user', 100
);

select throws_ok(
  $$ select public.resolve_shared_bill('18181818-1818-4181-8181-181818181818') $$,
  '23514',
  'every bill item must have an assignment',
  'resolution rejects an unassigned item'
);

select lives_ok(
  $$
    insert into public.transactions (
      id, user_id, description, amount_sen, transaction_date,
      payment_method, transaction_type, shared_status
    )
    values (
      '19191919-1919-4191-8191-191919191919',
      '12121212-1212-4121-8121-121212121212',
      'Signed rounding', 99, '2026-07-04',
      'cash', 'shared_expense', 'unresolved'
    );
    insert into public.bill_items (
      id, user_id, transaction_id, description, amount_sen
    )
    values (
      '20202020-2020-4202-8202-202020202020',
      '12121212-1212-4121-8121-121212121212',
      '19191919-1919-4191-8191-191919191919',
      'Item', 100
    );
    insert into public.bill_participants (
      id, user_id, transaction_id, participant_kind, amount_sen
    )
    values (
      md5('19191919-1919-4191-8191-191919191919:user')::uuid,
      '12121212-1212-4121-8121-121212121212',
      '19191919-1919-4191-8191-191919191919',
      'user', 99
    );
    insert into public.item_assignments (
      user_id, transaction_id, item_id, participant_id
    )
    values (
      '12121212-1212-4121-8121-121212121212',
      '19191919-1919-4191-8191-191919191919',
      '20202020-2020-4202-8202-202020202020',
      md5('19191919-1919-4191-8191-191919191919:user')::uuid
    );
    insert into public.bill_adjustments (
      id, user_id, transaction_id, adjustment_kind, amount_sen,
      distribution_method
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      '12121212-1212-4121-8121-121212121212',
      '19191919-1919-4191-8191-191919191919',
      'rounding', -1, 'user'
    )
  $$,
  'signed negative rounding can be stored'
);

select lives_ok(
  $$ select public.resolve_shared_bill('19191919-1919-4191-8191-191919191919') $$,
  'validated signed rounding resolves exactly'
);

select throws_ok(
  $$
    update public.bill_adjustments
    set transaction_id = '14141414-1414-4141-8141-141414141414'
    where id = '22222222-2222-4222-8222-222222222222'
  $$,
  '55000',
  'resolved shared bill allocations are immutable',
  'child reparenting checks the old resolved parent'
);

select is(
  (
    select shared_status
    from public.transactions
    where id = '19191919-1919-4191-8191-191919191919'
  ),
  'resolved'::text,
  'signed-rounding bill remains resolved after the rejected reparent'
);

select * from finish();

rollback;
