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
    'plan-user-a@example.test',
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
    'plan-user-b@example.test',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );

select has_table(
  'public',
  'financial_plan_templates',
  'financial plan templates table exists'
);
select has_table(
  'public',
  'financial_plan_entries',
  'financial plan entries table exists'
);
select has_column(
  'public',
  'financial_plan_templates',
  'user_id',
  'templates carry direct ownership'
);
select has_column(
  'public',
  'financial_plan_entries',
  'user_id',
  'entries carry direct ownership'
);
select col_not_null(
  'public',
  'financial_plan_templates',
  'user_id',
  'template ownership is required'
);
select col_not_null(
  'public',
  'financial_plan_entries',
  'user_id',
  'entry ownership is required'
);

select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.financial_plan_templates'::regclass
  ),
  true,
  'templates have row-level security enabled'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.financial_plan_entries'::regclass
  ),
  true,
  'entries have row-level security enabled'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_plan_templates'
      and roles = array['authenticated'::name]
  ),
  4::bigint,
  'templates have four authenticated CRUD policies'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_plan_entries'
      and roles = array['authenticated'::name]
  ),
  4::bigint,
  'entries have four authenticated CRUD policies'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select lives_ok(
  $$
    insert into public.financial_plan_templates (
      id,
      user_id,
      name,
      entry_type,
      amount_sen,
      effective_start,
      recurrence,
      expected_day,
      status
    )
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '22222222-2222-4222-8222-222222222222',
      'User B salary',
      'income',
      400000,
      '2026-01-01',
      'monthly',
      25,
      'confirmed'
    )
  $$,
  'User B can create an owned template'
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

select lives_ok(
  $$
    insert into public.financial_plan_templates (
      id,
      user_id,
      name,
      entry_type,
      amount_sen,
      effective_start,
      effective_end,
      recurrence,
      expected_day,
      due_day,
      status,
      is_active
    )
    values
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '11111111-1111-4111-8111-111111111111',
        'Salary',
        'income',
        500000,
        '2026-01-01',
        null,
        'monthly',
        28,
        null,
        'confirmed',
        true
      ),
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        '11111111-1111-4111-8111-111111111111',
        'Rent',
        'commitment',
        120000,
        '2026-01-01',
        null,
        'monthly',
        null,
        1,
        'active',
        true
      ),
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
        '11111111-1111-4111-8111-111111111111',
        'Emergency fund',
        'savings',
        50000,
        '2026-08-01',
        null,
        'monthly',
        null,
        15,
        'planned',
        true
      ),
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        '11111111-1111-4111-8111-111111111111',
        'Legacy fund',
        'investment',
        30000,
        '2026-01-01',
        '2026-06-30',
        'monthly',
        null,
        20,
        'planned',
        true
      ),
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
        '11111111-1111-4111-8111-111111111111',
        'Paused saving',
        'savings',
        10000,
        '2026-01-01',
        null,
        'monthly',
        null,
        10,
        'planned',
        false
      )
  $$,
  'User A can create income, commitment, savings, and investment templates'
);

select is(
  (select count(*) from public.financial_plan_templates),
  5::bigint,
  'User A cannot read User B template'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id,
      name,
      entry_type,
      amount_sen,
      effective_start,
      recurrence,
      expected_day,
      status
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      'Stolen salary',
      'income',
      1,
      '2026-01-01',
      'monthly',
      1,
      'pending'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "financial_plan_templates"',
  'User A cannot create a template for User B'
);

select results_eq(
  $$
    select period_start, generated_count
    from public.generate_monthly_plan('2026-07-01')
  $$,
  $$ values ('2026-07-01'::date, 2::integer) $$,
  'July generation snapshots only current active User A templates'
);

select results_eq(
  $$
    select
      name,
      entry_type,
      amount_sen,
      entry_date,
      expected_day,
      due_day,
      status
    from public.financial_plan_entries
    order by entry_date, name
  $$,
  $$
    values
      (
        'Rent'::text,
        'commitment'::text,
        120000::bigint,
        '2026-07-01'::date,
        null::smallint,
        1::smallint,
        'active'::text
      ),
      (
        'Salary'::text,
        'income'::text,
        500000::bigint,
        '2026-07-28'::date,
        28::smallint,
        null::smallint,
        'confirmed'::text
      )
  $$,
  'generated entries preserve dated income and commitment snapshot values'
);

select is(
  (
    select count(*)
    from public.financial_plan_entries
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
  ),
  0::bigint,
  'a future-effective template is excluded from the current period'
);

select is(
  (
    select count(*)
    from public.financial_plan_entries
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
  ),
  0::bigint,
  'a template ended before the period is excluded'
);

select throws_ok(
  $$
    select * from public.generate_monthly_plan('2026-07-01')
  $$,
  '23505',
  null,
  'duplicate period generation is rejected by the snapshot uniqueness guard'
);

select results_eq(
  $$
    select period_start, generated_count
    from public.generate_monthly_plan('2026-08-01')
  $$,
  $$ values ('2026-08-01'::date, 3::integer) $$,
  'future-effective templates generate when their period begins'
);

select results_eq(
  $$
    select entry_date
    from public.financial_plan_entries
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
      and period_start = '2026-08-01'
  $$,
  $$ values ('2026-08-15'::date) $$,
  'a generated savings entry uses its due day'
);

update public.financial_plan_templates
set
  name = 'Revised salary',
  amount_sen = 550000,
  expected_day = 31,
  status = 'pending'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select results_eq(
  $$
    select name, amount_sen, entry_date, status
    from public.financial_plan_entries
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and period_start = '2026-07-01'
  $$,
  $$
    values (
      'Salary'::text,
      500000::bigint,
      '2026-07-28'::date,
      'confirmed'::text
    )
  $$,
  'template edits do not rewrite historical entry snapshots'
);

select results_eq(
  $$
    select period_start, generated_count
    from public.generate_monthly_plan('2026-09-01')
  $$,
  $$ values ('2026-09-01'::date, 3::integer) $$,
  'a later period generates from the latest template values'
);

select results_eq(
  $$
    select name, amount_sen, entry_date, status
    from public.financial_plan_entries
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and period_start = '2026-09-01'
  $$,
  $$
    values (
      'Revised salary'::text,
      550000::bigint,
      '2026-09-30'::date,
      'pending'::text
    )
  $$,
  'new snapshots use edited values and cap day 31 within the period'
);

select throws_ok(
  $$
    select * from public.generate_monthly_plan('2026-09-02')
  $$,
  '22007',
  'period_start must be the first day of a calendar month',
  'generation rejects a date that is not a financial period start'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id, name, entry_type, amount_sen, effective_start,
      recurrence, due_day, status
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'Negative',
      'savings',
      -1,
      '2026-01-01',
      'monthly',
      1,
      'planned'
    )
  $$,
  '23514',
  null,
  'templates reject negative sen amounts'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id, name, entry_type, amount_sen, effective_start, effective_end,
      recurrence, due_day, status
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'Reversed',
      'investment',
      1,
      '2026-02-01',
      '2026-01-31',
      'monthly',
      1,
      'planned'
    )
  $$,
  '23514',
  null,
  'templates reject an effective end before their start'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id, name, entry_type, amount_sen, effective_start,
      recurrence, due_day, status
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'Weekly',
      'commitment',
      1,
      '2026-01-01',
      'weekly',
      1,
      'active'
    )
  $$,
  '23514',
  null,
  'templates reject unsupported recurrence'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id, name, entry_type, amount_sen, effective_start,
      recurrence, due_day, status
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'Bad status',
      'commitment',
      1,
      '2026-01-01',
      'monthly',
      1,
      'confirmed'
    )
  $$,
  '23514',
  null,
  'templates reject a status that is invalid for their type'
);

select throws_ok(
  $$
    insert into public.financial_plan_templates (
      user_id, name, entry_type, amount_sen, effective_start,
      recurrence, expected_day, status
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'Bad day',
      'income',
      1,
      '2026-01-01',
      'monthly',
      32,
      'pending'
    )
  $$,
  '23514',
  null,
  'templates reject an invalid expected day'
);

select throws_ok(
  $$
    insert into public.financial_plan_entries (
      template_id,
      user_id,
      period_start,
      entry_date,
      name,
      entry_type,
      amount_sen,
      recurrence,
      due_day,
      status,
      template_effective_start
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      '11111111-1111-4111-8111-111111111111',
      '2026-10-01',
      '2026-11-01',
      'Outside period',
      'commitment',
      1,
      'monthly',
      1,
      'active',
      '2026-01-01'
    )
  $$,
  '23514',
  null,
  'entries reject a dated value outside its financial period'
);

select throws_ok(
  $$
    insert into public.financial_plan_entries (
      template_id,
      user_id,
      period_start,
      entry_date,
      name,
      entry_type,
      amount_sen,
      recurrence,
      expected_day,
      status,
      template_effective_start
    )
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      '2026-10-01',
      '2026-10-25',
      'Cross-owner',
      'income',
      1,
      'monthly',
      25,
      'pending',
      '2026-01-01'
    )
  $$,
  '23503',
  null,
  'an entry cannot pair an owned user with another user template'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);

select results_eq(
  $$
    select period_start, generated_count
    from public.generate_monthly_plan('2026-07-01')
  $$,
  $$ values ('2026-07-01'::date, 1::integer) $$,
  'User B generates only their own period entries'
);

select is(
  (select count(*) from public.financial_plan_entries),
  1::bigint,
  'User B reads only their own generated entry'
);

select results_eq(
  $$
    update public.financial_plan_entries
    set amount_sen = 1
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning id
  $$,
  array[]::uuid[],
  'User B cannot update User A historical entries'
);

select * from finish();

rollback;
