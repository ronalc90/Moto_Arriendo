-- =============================================================================
-- Automated test: "Borrar datos de prueba" removes ONLY test data (and the
-- admin notifications that point to it) and keeps real data. Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', '3000000001@conductores.moto-arriendo.app'),
  ('00000000-0000-4000-8000-0000000000b9', '3110000000@conductores.moto-arriendo.app');
insert into public.profiles (id, full_name, phone, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin', null, 'admin', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'Hamer (prueba)', '3000000001', 'driver', null),
  ('00000000-0000-4000-8000-0000000000b9', 'Conductor Real', '3110000000', 'driver', null);
insert into public.drivers (id, profile_id, national_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', 'T-1'),
  ('00000000-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-0000000000b9', 'R-9');
insert into public.motorcycles (id, plate, owner_id, purchase_price, purchase_date) values
  ('00000000-0000-4000-8000-0000000000e1', 'PRU01A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 10),
  ('00000000-0000-4000-8000-0000000000e9', 'ABC12D', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 10);
insert into public.contracts (id, driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 40000, '{0}', current_date - 5),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-0000000000e9', 40000, '{0}', current_date - 5);
insert into public.payments (id, contract_id, driver_id, motorcycle_id, paid_on, total_amount, rate_amount, installment_amount, method, status) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', current_date, 40000, 40000, 0, 'cash', 'pending'),
  ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-0000000000e9', current_date, 40000, 40000, 0, 'cash', 'pending');
-- Leftover notifications: link to a test payment, text naming a test driver,
-- and one about real data that must survive.
delete from public.notifications;
insert into public.notifications (profile_id, kind, title, body, url, dedupe_key) values
  ('00000000-0000-4000-8000-0000000000a1', 'x', 'Nuevo pago', '$40.000', '/admin/pagos/00000000-0000-4000-8000-0000000000f1', 'k1'),
  ('00000000-0000-4000-8000-0000000000a1', 'x', 'Inspección pendiente: Hamer (prueba)', 'PRU01A', '/admin/inspecciones', 'k2'),
  ('00000000-0000-4000-8000-0000000000a1', 'x', 'Nuevo pago de Conductor Real', '$40.000', '/admin/pagos/00000000-0000-4000-8000-0000000000f9', 'k3');

-- Run it as the admin, like the app does.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  assert public.has_test_data(), 'admin must see test data';
  r := public.admin_purge_test_data();
  assert (r ->> 'motorcycles')::int = 1 and (r ->> 'drivers')::int = 1 and (r ->> 'payments')::int = 1, 'unexpected counts ' || r::text;
  assert not public.has_test_data(), 'test data must be gone';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

do $$ begin
  assert not exists (select 1 from public.motorcycles where plate = 'PRU01A'), 'test moto left';
  assert not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000b1'), 'test user left';
  assert exists (select 1 from public.motorcycles where plate = 'ABC12D'), 'real moto deleted!';
  assert exists (select 1 from public.payments where id = '00000000-0000-4000-8000-0000000000f9'), 'real payment deleted!';
  assert exists (select 1 from public.drivers where id = '00000000-0000-4000-8000-0000000000d9'), 'real driver deleted!';
  assert (select count(*) from public.notifications) = 1, 'test notifications left: ' || (select string_agg(title, ', ') from public.notifications);
  assert exists (select 1 from public.notifications where dedupe_key = 'k3'), 'real notification deleted!';
  raise notice 'Purge tests OK';
end $$;
rollback;
