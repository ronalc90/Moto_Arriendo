-- =============================================================================
-- Automated test: maintenance alerts, scheduled notifications, cron secret,
-- notification privacy and finance views (Phase 2 and 3). Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.com'),
  ('00000000-0000-4000-8000-0000000000b2', 'b2@example.com');
insert into public.profiles (id, full_name, phone, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin Prueba', null, 'admin', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'Conductor A', '3000000001', 'driver', null),
  ('00000000-0000-4000-8000-0000000000b2', 'Conductor B', '3000000002', 'driver', null);
insert into public.drivers (id, profile_id, national_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', 'T-1'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b2', 'T-2');
insert into public.motorcycles (id, plate, owner_id, purchase_price, purchase_date, current_km) values
  ('00000000-0000-4000-8000-0000000000e1', 'TST01A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 30, 1850),
  ('00000000-0000-4000-8000-0000000000e2', 'TST02A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 30, 300);
insert into public.contracts (id, driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 40000, '{0}', public.bogota_today() - 14),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000e2', 40000, '{0}', public.bogota_today() - 14);

-- First service done at 950 km on moto 1 -> next oil change at 2950, but alert
-- distance 200 means 1850 is fine. Move to 2800 to be "soon".
insert into public.maintenance_records (motorcycle_id, service_type, km, cost, paid_by)
values ('00000000-0000-4000-8000-0000000000e1', 'first_service', 950, 0, 'owner');
update public.motorcycles set current_km = 2800 where id = '00000000-0000-4000-8000-0000000000e1';

-- SOAT of moto 1 expires in 15 days
insert into public.documents (entity, motorcycle_id, doc_type, expires_on)
values ('motorcycle', '00000000-0000-4000-8000-0000000000e1', 'soat', public.bogota_today() + 15);

-- Some income and costs for finance
insert into public.payments (contract_id, paid_on, total_amount, rate_amount, installment_amount, method, status)
values ('00000000-0000-4000-8000-0000000000c1', public.bogota_today(), 400000, 400000, 0, 'nequi', 'approved');
insert into public.expenses (motorcycle_id, category, amount) values ('00000000-0000-4000-8000-0000000000e1', 'gps', 100000);
insert into public.incidents (motorcycle_id, kind, description, cost, paid_by, responsible)
values ('00000000-0000-4000-8000-0000000000e1', 'fine', 'Comparendo de prueba', 50000, 'owner', 'owner');

insert into private.app_secrets (key, value) values ('cron', repeat('x', 40));

do $$
declare
  v record;
  n integer;
begin
  -- Maintenance status
  select * into v from public.maintenance_due
   where motorcycle_id = '00000000-0000-4000-8000-0000000000e1' and service_type = 'oil_change';
  assert v.next_km = 2950 and v.status = 'soon', format('oil change %s/%s', v.next_km, v.status);
  assert not exists (select 1 from public.maintenance_due
    where motorcycle_id = '00000000-0000-4000-8000-0000000000e1' and service_type = 'first_service'),
    'first service done -> not listed';
  select * into v from public.maintenance_due
   where motorcycle_id = '00000000-0000-4000-8000-0000000000e2' and service_type = 'first_service';
  assert v.status = 'ok', format('moto2 first service %s', v.status);

  -- Notifications generation (at 19:30 Bogota today)
  n := public.generate_notifications((public.bogota_today() + time '19:30') at time zone 'America/Bogota');
  assert n > 0, 'notifications created';
  assert exists (select 1 from public.notifications where kind = 'maintenance'
                 and profile_id = '00000000-0000-4000-8000-0000000000a1' and title like 'Cambio de aceite%'),
    'admin gets oil change alert';
  assert exists (select 1 from public.notifications where kind = 'expiration'
                 and profile_id = '00000000-0000-4000-8000-0000000000a1' and title like 'SOAT TST01A vence en 15 días'),
    'admin gets SOAT 15 days alert';
  -- idempotent
  n := public.generate_notifications((public.bogota_today() + time '19:30') at time zone 'America/Bogota');
  assert n = 0, format('second run must not duplicate (%s)', n);

  -- Cron secret
  begin
    perform public.cron_collect('wrong-secret-wrong-secret-wrong-secret!!', false);
    assert false, 'wrong secret must fail';
  exception when raise_exception then null;
  end;
  assert jsonb_array_length((public.cron_collect(repeat('x', 40), false)) -> 'items') > 0, 'cron collect returns items';

  -- Finance
  select * into v from public.motorcycle_payback where motorcycle_id = '00000000-0000-4000-8000-0000000000e1';
  assert v.income = 400000 and v.costs = 150000 and v.net = 250000, format('payback %s/%s/%s', v.income, v.costs, v.net);
  assert v.remaining = 5750000, format('remaining %s', v.remaining);

  raise notice 'Phase 2/3 tests OK';
end;
$$;

-- Notification privacy: driver A only sees own notifications, no incidents of others, no expenses
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true);
do $$
begin
  assert not exists (select 1 from public.notifications where profile_id <> '00000000-0000-4000-8000-0000000000b2'),
    'driver sees only own notifications';
  assert (select count(*) from public.expenses) = 0, 'driver cannot see expenses';
  assert (select count(*) from public.incidents) = 0, 'driver cannot see incidents of other motos';
  assert (select count(*) from public.maintenance_records) = 0, 'driver B cannot see maintenance of moto A';
  begin
    perform public.generate_notifications(now());
    assert false, 'driver must not run generate_notifications';
  exception when insufficient_privilege then null;
  end;
  raise notice 'Phase 2/3 RLS OK';
end;
$$;
reset role;

rollback;
