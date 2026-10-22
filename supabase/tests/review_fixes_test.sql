-- =============================================================================
-- Automated test for the fixes from the independent review. Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.com'),
  ('00000000-0000-4000-8000-0000000000b2', 'b2@example.com');
insert into public.profiles (id, full_name, phone, role, email, data_consent_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin', null, 'admin', 'a@example.com', null),
  ('00000000-0000-4000-8000-0000000000b1', 'Conductor A', '3100000001', 'driver', null, now()),
  ('00000000-0000-4000-8000-0000000000b2', 'Conductor B', '3100000002', 'driver', null, now());
insert into public.drivers (id, profile_id, national_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', 'T-1'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b2', 'T-2');
insert into public.motorcycles (id, plate, owner_id, purchase_price, purchase_date, current_km) values
  ('00000000-0000-4000-8000-0000000000e1', 'TST01A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 30, 1000),
  ('00000000-0000-4000-8000-0000000000e2', 'TST02A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date - 30, 1000);
insert into public.contracts (id, driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', 40000, '{}', public.bogota_today() - 3),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000e2', 40000, '{}', public.bogota_today() - 3);
insert into public.documents (id, entity, motorcycle_id, doc_type, file_path) values
  ('00000000-0000-4000-8000-0000000000f0', 'motorcycle', '00000000-0000-4000-8000-0000000000e1', 'soat', 'moto/00000000-0000-4000-8000-0000000000e1/soat.pdf');

-- 1) One active loan per driver
insert into public.loans (driver_id, concept, amount, daily_installment) values
  ('00000000-0000-4000-8000-0000000000d1', 'Pase', 1000000, 10000);
do $$ begin
  begin
    insert into public.loans (driver_id, concept, amount, daily_installment) values
      ('00000000-0000-4000-8000-0000000000d1', 'Casco', 200000, 5000);
    raise exception 'FAIL: second active loan accepted';
  exception when unique_violation then null;
  end;
end $$;
delete from public.loans;

-- Act as driver A
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

do $$
declare v_created timestamptz;
begin
  -- 2) Paths outside the driver's folder are rejected
  begin
    insert into public.documents (entity, driver_id, doc_type, file_path)
    values ('driver', '00000000-0000-4000-8000-0000000000d1', 'other', 'moto/00000000-0000-4000-8000-0000000000e1/soat.pdf');
    raise exception 'FAIL: document pointing at the SOAT accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into public.payments (contract_id, paid_on, total_amount, method, receipt_path)
    values ('00000000-0000-4000-8000-0000000000c1', public.bogota_today(), 40000, 'nequi', '00000000-0000-4000-8000-0000000000d2/x.jpg');
    raise exception 'FAIL: receipt from another folder accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into public.damage_reports (description, photos) values ('x', array['../d2/x.jpg']);
    raise exception 'FAIL: damage photo outside folder accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- own folder works, created_at is forced to now
  insert into public.documents (entity, driver_id, doc_type, file_path)
  values ('driver', '00000000-0000-4000-8000-0000000000d1', 'license', '00000000-0000-4000-8000-0000000000d1/lic.jpg');
  insert into public.payments (contract_id, paid_on, total_amount, method, receipt_path, created_at)
  values ('00000000-0000-4000-8000-0000000000c1', public.bogota_today(), 160000, 'nequi',
          '00000000-0000-4000-8000-0000000000d1/r.jpg', now() - interval '10 days')
  returning created_at into v_created;
  assert v_created > now() - interval '1 minute', 'created_at must be forced to now';

  -- 4) Odometer sanity
  begin
    insert into public.inspections (checklist, km, photo_front, photo_back, photo_left, photo_right, photo_dashboard)
    values ('{"tires":"ok","brakes":"ok","chain":"ok","lights":"ok","oil":"ok"}', 99999, '00000000-0000-4000-8000-0000000000d1/1.jpg', '00000000-0000-4000-8000-0000000000d1/2.jpg',
            '00000000-0000-4000-8000-0000000000d1/3.jpg', '00000000-0000-4000-8000-0000000000d1/4.jpg',
            '00000000-0000-4000-8000-0000000000d1/5.jpg');
    raise exception 'FAIL: +98.999 km accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  insert into public.inspections (checklist, km, photo_front, photo_back, photo_left, photo_right, photo_dashboard)
  values ('{"tires":"ok","brakes":"ok","chain":"ok","lights":"ok","oil":"ok"}', 1350, '00000000-0000-4000-8000-0000000000d1/1.jpg', '00000000-0000-4000-8000-0000000000d1/2.jpg',
          '00000000-0000-4000-8000-0000000000d1/3.jpg', '00000000-0000-4000-8000-0000000000d1/4.jpg',
          '00000000-0000-4000-8000-0000000000d1/5.jpg');

  -- 5) Push subscriptions: only real push services, at most 5
  begin
    perform public.save_push_subscription('https://evil.example.com/hang', 'k', 'a');
    raise exception 'FAIL: fake push endpoint accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  for i in 1..10 loop
    perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dev' || i, 'k', 'a');
  end loop;
  perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dev1', 'k2', 'a'); -- same device: ok
  begin
    perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dev11', 'k', 'a');
    raise exception 'FAIL: 11th device accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
    values ('00000000-0000-4000-8000-0000000000b1', 'https://fcm.googleapis.com/fcm/send/direct', 'k', 'a');
    raise exception 'FAIL: direct insert over the limit accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- 6) No "atraso" notice when the payment under review covers the debt
do $$
declare v_at timestamptz := (public.bogota_today() + time '22:00') at time zone 'America/Bogota';
begin
  delete from public.notifications;
  perform public.generate_notifications(v_at);
  assert not exists (select 1 from public.notifications where kind like 'late%' and title like '%Conductor A%')
     and not exists (select 1 from public.notifications where kind = 'late' and profile_id = '00000000-0000-4000-8000-0000000000b1'),
    'driver A paid (pending) and must not get a late notice';
  assert exists (select 1 from public.notifications where kind = 'late' and profile_id = '00000000-0000-4000-8000-0000000000b2'),
    'driver B did not pay and must get a late notice';
  raise notice 'Review fixes tests OK';
end $$;
rollback;
