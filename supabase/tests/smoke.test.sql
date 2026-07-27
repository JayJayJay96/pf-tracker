begin;

select plan(1);

select ok(true, 'the local database test harness can execute pgTAP tests');

select * from finish();

rollback;
