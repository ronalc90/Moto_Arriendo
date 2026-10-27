-- =============================================================================
-- Automated test: balance rules + RLS isolation between drivers.
-- Runs inside a transaction and rolls everything back.
-- Usage (local):   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_balance_test.sql
-- Usage (Supabase): paste into the SQL editor and run. Any failure raises an error.
--
-- Scenario (fixed "now" = 2026-10-21 22:00 Bogota, after the 21:00 deadline):
--   Contracts start Monday 2026-09-28, rest day Sunday, $40.000/day.
--   Chargeable days through 21/10 = 24 days - 3 Sundays = 21 -> $840.000
--   Driver A (al dia): paid 21 days + 21 loan installments of $10.000.
--   Driver B: paid 19 days -> owes $80.000 -> 2 late days -> yellow.
-- =============================================================================
begin;

-- IDs
create temp table t_ids as select
  '00000000-0000-4000-8000-0000000000a1'::uuid as admin_id,
  '00000000-0000-4000-8000-0000000000b1'::uuid as user_a,
  '00000000-0000-4000-8000-0000000000b2'::uuid as user_b;
grant select on t_ids to authenticated;

insert into auth.users (id, email)
select admin_id, 'test-admin@example.com' from t_ids union all
select user_a, 'test-a@example.com' from t_ids union all
select user_b, 'test-b@example.com' from t_ids;

insert into public.profiles (id, full_name, phone, role, data_consent_at)
select admin_id, 'Admin Prueba', null::text, 'admin'::public.user_role, now() from t_ids union all
select user_a, 'Conductor A', '3000000001', 'driver'::public.user_role, now() from t_ids union all
select user_b, 'Conductor B', '3000000002', 'driver'::public.user_role, now() from t_ids;

insert into public.drivers (id, profile_id, national_id)
select '00000000-0000-4000-8000-0000000000d1'::uuid, user_a, 'T-1001' from t_ids union all
select '00000000-0000-4000-8000-0000000000d2', user_b, 'T-1002' from t_ids;

insert into public.motorcycles (id, plate, owner_id, purchase_date)
select '00000000-0000-4000-8000-0000000000e1'::uuid, 'TST01A', admin_id, '2026-09-20'::date from t_ids union all
select '00000000-0000-4000-8000-0000000000e2', 'TST02A', admin_id, '2026-09-20' from t_ids;

insert into public.contracts (id, driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-0000000000e1', 40000, '{0}', '2026-09-28'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000d2',
   '00000000-0000-4000-8000-0000000000e2', 40000, '{0}', '2026-09-28');

insert into public.loans (id, driver_id, concept, amount, daily_installment, installment_required, loan_date) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000d1',
   'Pase A2', 1200000, 10000, true, '2026-09-28');

-- Approved payments (inserted as privileged role, explicit split)
insert into public.payments (contract_id, paid_on, total_amount, rate_amount, installment_amount, loan_id, method, status)
values
  ('00000000-0000-4000-8000-0000000000c1', '2026-10-21', 1050000, 840000, 210000,
   '00000000-0000-4000-8000-0000000000f1', 'nequi', 'approved'),
  ('00000000-0000-4000-8000-0000000000c2', '2026-10-19', 760000, 760000, 0, null, 'daviplata', 'approved'),
  ('00000000-0000-4000-8000-0000000000c2', '2026-10-20', 40000, 40000, 0, null, 'nequi', 'pending');
insert into public.payments (contract_id, paid_on, total_amount, rate_amount, installment_amount, method, status, rejection_reason)
values ('00000000-0000-4000-8000-0000000000c2', '2026-10-18', 40000, 40000, 0, 'nequi', 'rejected', 'Comprobante ilegible');

-- ---------------------------------------------------------------------------
-- Balance assertions
-- ---------------------------------------------------------------------------
do $$
declare
  s record;
  v_now timestamptz := '2026-10-21 22:00:00-05';
  v_before timestamptz := '2026-10-21 20:00:00-05';
begin
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c1', v_now);
  assert s.chargeable_days = 21, format('A chargeable days = %s', s.chargeable_days);
  assert s.expected_rate = 840000, format('A expected = %s', s.expected_rate);
  assert s.total_debt = 0, format('A debt = %s', s.total_debt);
  assert s.light = 'green', format('A light = %s', s.light);
  assert s.loan_balance = 990000, format('A loan balance = %s', s.loan_balance);

  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c2', v_now);
  assert s.total_debt = 80000, format('B debt = %s', s.total_debt);
  assert s.late_days = 2, format('B late days = %s', s.late_days);
  assert s.light = 'yellow', format('B light = %s', s.light);
  assert s.pending_count = 1, format('B pending = %s', s.pending_count);

  -- Before the 21:00 deadline today does not count yet
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c2', v_before);
  assert s.chargeable_days = 20, format('B chargeable before deadline = %s', s.chargeable_days);
  assert s.late_days = 1, format('B late before deadline = %s', s.late_days);
  assert s.due_today = 80000, format('B due today = %s', s.due_today);

  -- Exempt day reduces the debt
  insert into public.exempt_days (contract_id, day, reason)
  values ('00000000-0000-4000-8000-0000000000c2', '2026-10-15', 'Moto en taller por garantia');
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c2', v_now);
  assert s.late_days = 1, format('B late with exempt = %s', s.late_days);
  delete from public.exempt_days where contract_id = '00000000-0000-4000-8000-0000000000c2';

  -- Mandatory installment debt counts in the traffic light:
  -- remove A's installments -> owes 21 x 10.000 = 210.000 -> ceil(210000/50000) = 5 -> red
  update public.payments set rate_amount = 1050000, installment_amount = 0
   where contract_id = '00000000-0000-4000-8000-0000000000c1';
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c1', v_now);
  assert s.installment_debt = 210000, format('A inst debt = %s', s.installment_debt);
  -- the extra 210.000 of fee is an advance, but loan debt still counts
  assert s.late_days = 5, format('A late with inst debt = %s', s.late_days);
  assert s.light = 'red', format('A light with inst debt = %s', s.light);
  update public.payments set rate_amount = 840000, installment_amount = 210000,
         loan_id = '00000000-0000-4000-8000-0000000000f1'
   where contract_id = '00000000-0000-4000-8000-0000000000c1';

  -- Allocation: B pays 50.000 now -> all to fee (owes 80.000 incl. pending 40.000 -> owes 40.000 more)
  select * into s from public.allocate_payment('00000000-0000-4000-8000-0000000000c2', 50000, null, v_now);
  assert s.rate_amount = 50000 and s.installment_amount = 0, format('alloc B = %s/%s', s.rate_amount, s.installment_amount);
  -- A is up to date: pays 50.000 -> 40.000 fee + 10.000 loan
  select * into s from public.allocate_payment('00000000-0000-4000-8000-0000000000c1', 50000, null, v_now);
  assert s.rate_amount = 40000 and s.installment_amount = 10000, format('alloc A = %s/%s', s.rate_amount, s.installment_amount);

  -- Calendar: B has 19 paid days, 2 overdue
  assert (select count(*) from public.contract_calendar('00000000-0000-4000-8000-0000000000c2',
          '2026-09-28', '2026-10-24', v_now) where kind = 'paid') = 19, 'B paid days in calendar';
  assert (select count(*) from public.contract_calendar('00000000-0000-4000-8000-0000000000c2',
          '2026-09-28', '2026-10-24', v_now) where kind = 'overdue') = 2, 'B overdue days in calendar';
  assert (select count(*) from public.contract_calendar('00000000-0000-4000-8000-0000000000c2',
          '2026-09-28', '2026-10-24', v_now) where kind = 'rest') = 3, 'B rest days in calendar';

  -- Loan becomes paid automatically when fully covered
  insert into public.payments (contract_id, paid_on, total_amount, rate_amount, installment_amount, loan_id, method, status)
  values ('00000000-0000-4000-8000-0000000000c1', '2026-10-21', 990000, 0, 990000,
          '00000000-0000-4000-8000-0000000000f1', 'cash', 'approved');
  assert (select status from public.loans where id = '00000000-0000-4000-8000-0000000000f1') = 'paid', 'loan auto paid';
  delete from public.payments where total_amount = 990000;
  assert (select status from public.loans where id = '00000000-0000-4000-8000-0000000000f1') = 'active', 'loan back to active';

  raise notice 'Balance tests OK';
end;
$$;

-- The driver insert below goes through the payments trigger, which splits with the
-- real now(), not the fixed 21/10 above. Top up A's approved fee through today so A
-- is still up to date whenever the test runs (no-op on 21/10).
update public.payments
   set total_amount = total_amount + x.extra, rate_amount = rate_amount + x.extra
  from (select greatest(public.expected_rate('00000000-0000-4000-8000-0000000000c1', '2026-09-28',
                                             public.bogota_today()) - 840000, 0) as extra) x
 where contract_id = '00000000-0000-4000-8000-0000000000c1' and status = 'approved';

-- ---------------------------------------------------------------------------
-- RLS assertions: act as driver A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

do $$
declare
  v_count integer;
  v_failed boolean;
begin
  assert not public.is_admin(), 'driver must not be admin';
  assert public.my_driver_id() = '00000000-0000-4000-8000-0000000000d1', 'my_driver_id';

  select count(*) into v_count from public.payments where driver_id = '00000000-0000-4000-8000-0000000000d2';
  assert v_count = 0, 'A must not see B payments';
  select count(*) into v_count from public.payments;
  assert v_count = 1, format('A sees only own payments (%s)', v_count);
  select count(*) into v_count from public.profiles;
  assert v_count = 1, format('A sees only own profile (%s)', v_count);
  select count(*) into v_count from public.drivers;
  assert v_count = 1, 'A sees only own driver row';
  select count(*) into v_count from public.contracts;
  assert v_count = 1, 'A sees only own contract';
  select count(*) into v_count from public.motorcycles;
  assert v_count = 1, 'A sees only own motorcycle';
  select count(*) into v_count from public.contract_overview;
  assert v_count = 1, 'A sees only own overview';
  select count(*) into v_count from public.loans;
  assert v_count = 1, 'A sees own loan';
  select count(*) into v_count from public.audit_log;
  assert v_count = 0, 'A cannot read audit log';
  select count(*) into v_count from public.contract_summary('00000000-0000-4000-8000-0000000000c2');
  assert v_count = 0, 'A cannot compute B summary';

  -- Cannot insert a payment on B's contract
  v_failed := false;
  begin
    insert into public.payments (contract_id, total_amount, method, receipt_path)
    values ('00000000-0000-4000-8000-0000000000c2', 40000, 'nequi', 'x/y.jpg');
  exception when others then v_failed := true;
  end;
  assert v_failed, 'A must not insert payment for B';

  -- Can insert own payment; status forced to pending and split computed by DB
  insert into public.payments (contract_id, total_amount, method, receipt_path, status, rate_amount)
  values ('00000000-0000-4000-8000-0000000000c1', 50000, 'nequi',
          '00000000-0000-4000-8000-0000000000d1/r.jpg', 'pending', 50000);
  select count(*) into v_count from public.payments
   where driver_id = '00000000-0000-4000-8000-0000000000d1' and status = 'pending'
     and installment_amount = 10000;
  assert v_count = 1, 'own payment inserted as pending with DB split';

  -- Cannot approve payments
  update public.payments set status = 'approved' where status = 'pending';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'A must not approve payments';

  -- Cannot change own profile role
  update public.profiles set role = 'admin';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'A must not update profile';

  -- Storage: can upload to own folder, not to B's
  insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-4000-8000-0000000000d1/ok.jpg');
  v_failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-4000-8000-0000000000d2/bad.jpg');
  exception when others then v_failed := true;
  end;
  assert v_failed, 'A must not upload into B folder';

  -- Documents: cannot register a document for B
  v_failed := false;
  begin
    insert into public.documents (entity, driver_id, doc_type)
    values ('driver', '00000000-0000-4000-8000-0000000000d2', 'license');
  exception when others then v_failed := true;
  end;
  assert v_failed, 'A must not create documents for B';

  raise notice 'RLS tests OK';
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain SQL-editor session

-- Storage read isolation (objects created as privileged role)
insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-4000-8000-0000000000d2/b.jpg');
set local role authenticated;
do $$
begin
  assert (select count(*) from storage.objects where name like '00000000-0000-4000-8000-0000000000d2/%') = 0,
    'A must not read B files';
  raise notice 'Storage tests OK';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain SQL-editor session

-- ---------------------------------------------------------------------------
-- Admin assertions: approving a payment stamps reviewer and writes audit log
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  v_id uuid;
  r record;
begin
  assert public.is_admin(), 'admin must be admin';
  assert (select count(*) from public.payments) >= 5, 'admin sees all payments';
  select id into v_id from public.payments
   where contract_id = '00000000-0000-4000-8000-0000000000c2' and status = 'pending' limit 1;
  update public.payments set status = 'approved' where id = v_id;
  select * into r from public.payments where id = v_id;
  assert r.reviewed_by = '00000000-0000-4000-8000-0000000000a1' and r.reviewed_at is not null, 'reviewer stamped';
  assert exists (select 1 from public.audit_log where record_id = v_id and action = 'payment_approved'
                 and actor_id = '00000000-0000-4000-8000-0000000000a1'), 'audit log written';
  -- rejecting without a reason fails
  begin
    update public.payments set status = 'rejected' where id = v_id;
    assert false, 'reject without reason must fail';
  exception when check_violation then null;
  end;
  raise notice 'Admin tests OK';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain SQL-editor session

rollback;
