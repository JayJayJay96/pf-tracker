begin;

select plan(35);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'user-a@example.test',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'user-b@example.test',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'categories', 'categories table exists');
select has_index('public', 'profiles', 'profiles_user_id_idx', 'profiles has a user_id index');
select has_index('public', 'categories', 'categories_user_id_idx', 'categories has a user_id index');

select results_eq(
  $$
    select currency, time_zone, period_type, default_payment_method
    from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  $$ values ('RM'::text, 'Asia/Kuala_Lumpur'::text, 'calendar_month'::text, 'tng'::text) $$,
  'the new-user trigger creates User A profile defaults'
);

select results_eq(
  $$
    select currency, time_zone, period_type, default_payment_method
    from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222'
  $$,
  $$ values ('RM'::text, 'Asia/Kuala_Lumpur'::text, 'calendar_month'::text, 'tng'::text) $$,
  'the new-user trigger creates User B profile defaults'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);

select lives_ok(
  $$
    insert into public.categories (user_id, name, type, sort_order)
    values ('22222222-2222-4222-8222-222222222222', 'User B food', 'expense', 0)
  $$,
  'User B can insert an owned category'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'User A can read only their own profile'
);

select is(
  (
    select count(*)
    from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'User A cannot read User B profile'
);

select results_eq(
  $$
    update public.profiles
    set default_payment_method = 'cash'
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning default_payment_method
  $$,
  $$ values ('cash'::text) $$,
  'User A can update their own profile'
);

select results_eq(
  $$
    update public.profiles
    set currency = 'RM'
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning id
  $$,
  array[]::uuid[],
  'User A cannot update User B profile'
);

select results_eq(
  $$
    delete from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning id
  $$,
  array[]::uuid[],
  'User A cannot delete User B profile'
);

select throws_ok(
  $$
    update public.profiles
    set user_id = '22222222-2222-4222-8222-222222222222'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'User A cannot reassign their profile to User B'
);

select results_eq(
  $$
    delete from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning user_id
  $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'User A can delete their own profile'
);

select lives_ok(
  $$
    insert into public.profiles (user_id)
    values ('11111111-1111-4111-8111-111111111111')
  $$,
  'User A can insert their own profile'
);

select throws_ok(
  $$
    insert into public.profiles (user_id)
    values ('22222222-2222-4222-8222-222222222222')
  $$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'User A cannot insert a profile for User B'
);

select lives_ok(
  $$
    insert into public.categories (user_id, name, type, sort_order)
    values ('11111111-1111-4111-8111-111111111111', 'User A food', 'expense', 1)
  $$,
  'User A can insert an owned category'
);

select is(
  (select count(*) from public.categories),
  1::bigint,
  'User A can read only their own categories'
);

select results_eq(
  $$
    update public.categories
    set name = 'User A dining', sort_order = 2, is_active = false
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning name, sort_order, is_active
  $$,
  $$ values ('User A dining'::text, 2::integer, false) $$,
  'User A can update their own category'
);

select results_eq(
  $$
    update public.categories
    set name = 'tampered'
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning id
  $$,
  array[]::uuid[],
  'User A cannot update User B category'
);

select results_eq(
  $$
    delete from public.categories
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning id
  $$,
  array[]::uuid[],
  'User A cannot delete User B category'
);

select throws_ok(
  $$
    insert into public.categories (user_id, name, type)
    values ('22222222-2222-4222-8222-222222222222', 'Stolen', 'expense')
  $$,
  '42501',
  'new row violates row-level security policy for table "categories"',
  'User A cannot insert a category for User B'
);

select throws_ok(
  $$
    update public.categories
    set user_id = '22222222-2222-4222-8222-222222222222'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '42501',
  'new row violates row-level security policy for table "categories"',
  'User A cannot reassign their category to User B'
);

select results_eq(
  $$
    delete from public.categories
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning user_id
  $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'User A can delete their own category'
);

select throws_ok(
  $$
    update public.profiles
    set currency = 'USD'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '23514',
  null,
  'profiles reject an unsupported currency'
);

select throws_ok(
  $$
    update public.profiles
    set period_type = 'weekly'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '23514',
  null,
  'profiles reject an unsupported period type'
);

select throws_ok(
  $$
    update public.profiles
    set default_payment_method = 'card'
    where user_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '23514',
  null,
  'profiles reject an unsupported payment method'
);

select throws_ok(
  $$
    insert into public.categories (user_id, name, type)
    values ('11111111-1111-4111-8111-111111111111', 'Unknown', 'unknown')
  $$,
  '23514',
  null,
  'categories reject an unsupported type'
);

select throws_ok(
  $$
    insert into public.categories (user_id, name, type, sort_order)
    values ('11111111-1111-4111-8111-111111111111', 'Negative', 'expense', -1)
  $$,
  '23514',
  null,
  'categories reject a negative sort order'
);

select throws_ok(
  $$
    insert into public.categories (user_id, name, type)
    values ('11111111-1111-4111-8111-111111111111', '   ', 'expense')
  $$,
  '23514',
  null,
  'categories reject a blank name'
);

reset role;

select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass
  ),
  true,
  'profiles has row-level security enabled'
);

select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.categories'::regclass
  ),
  true,
  'categories has row-level security enabled'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and roles = array['authenticated'::name]
  ),
  4::bigint,
  'profiles has four authenticated CRUD policies'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and roles = array['authenticated'::name]
  ),
  4::bigint,
  'categories has four authenticated CRUD policies'
);

select is(
  (
    select proconfig
    from pg_proc
    where oid = 'public.handle_new_user()'::regprocedure
  ),
  array['search_path=""']::text[],
  'the new-user trigger function constrains its search path'
);

select * from finish();

rollback;
