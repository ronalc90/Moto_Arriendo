-- =============================================================================
-- Automated test: username accounts, first sign-in, rate changes, pending
-- setup reminders. Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'a@example.com');
insert into public.profiles (id, full_name, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin', 'admin', 'a@example.com');

-- Act as the admin
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  v_driver uuid;
  v_profile public.profiles%rowtype;
begin
  -- A) username + 4-character password
  v_driver := public.admin_create_driver_account('Hamer', 'Hamer', null, '1234');
  select p.* into v_profile from public.profiles p join public.drivers d on d.profile_id = p.id where d.id = v_driver;
  assert v_profile.username = 'hamer', 'username stored lowercase';
  assert v_profile.must_change_password, 'must change password on first sign-in';
  assert v_profile.onboarded_at is null, 'not onboarded yet';
  begin
    perform public.admin_create_driver_account('Otro', 'hamer', null, '1234');
    raise exception 'FAIL: duplicate username accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.admin_create_driver_account('Otro', 'ha mer', null, '1234');
    raise exception 'FAIL: username with spaces accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.admin_create_driver_account('Otro', 'otro', null, '123');
    raise exception 'FAIL: 3-character password accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform public.admin_create_driver_account('Jeison', 'jeison', null, '1234');

  -- C) pending setup: both drivers need a motorcycle + contract and their data
  assert (select count(*) from public.setup_pending() where kind = 'contract') = 2, 'two drivers without contract';
  assert (select count(*) from public.setup_pending() where kind = 'driver_data') = 2, 'two drivers without data';
  assert (select title from public.setup_pending() where kind = 'contract' limit 1) like 'Falta la moto y el contrato de %', 'no free motorcycle yet';
end $$;

-- Motorcycle without documents -> pending; contract without file -> pending
insert into public.motorcycles (id, plate, owner_id, purchase_price, purchase_date)
values ('00000000-0000-4000-8000-0000000000e1', 'ABC12D', '00000000-0000-4000-8000-0000000000a1', 6290000, current_date - 20);
do $$ begin
  assert exists (select 1 from public.setup_pending() where kind = 'moto_docs' and title = 'A la moto ABC12D le falta el SOAT y el seguro'), 'moto docs pending';
  assert (select title from public.setup_pending() where kind = 'contract' limit 1) like 'Falta el contrato de %', 'free motorcycle -> only contract';
end $$;
insert into public.contracts (id, driver_id, motorcycle_id, daily_rate, rest_weekdays, start_date)
select '00000000-0000-4000-8000-0000000000c1', d.id, '00000000-0000-4000-8000-0000000000e1', 40000, '{}', public.bogota_today() - 10
  from public.drivers d join public.profiles p on p.id = d.profile_id where p.username = 'hamer';

-- D) rate change from 4 days ago: past days keep 40.000
do $$
declare
  v_at timestamptz := (public.bogota_today() + time '22:00') at time zone 'America/Bogota';
  s record;
  k record;
begin
  perform public.admin_change_contract_rate('00000000-0000-4000-8000-0000000000c1', public.bogota_today() - 4, 50000);
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c1', v_at);
  assert s.expected_rate = 6 * 40000 + 5 * 50000, format('expected %s', s.expected_rate);
  assert s.daily_rate = 50000, 'current rate shown';
  begin
    perform public.admin_change_contract_rate('00000000-0000-4000-8000-0000000000c1', public.bogota_today() - 30, 50000);
    raise exception 'FAIL: rate before the contract start accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  insert into public.payments (contract_id, paid_on, total_amount, rate_amount, installment_amount, method, status)
  values ('00000000-0000-4000-8000-0000000000c1', public.bogota_today(), 260000, 260000, 0, 'cash', 'approved');
  select * into k from public.contract_calendar('00000000-0000-4000-8000-0000000000c1',
    public.bogota_today() - 4, public.bogota_today() - 4, v_at);
  assert k.kind = 'partial' and k.amount_covered = 20000, format('calendar %s %s', k.kind, k.amount_covered);
  select * into s from public.contract_summary('00000000-0000-4000-8000-0000000000c1', v_at);
  assert s.total_debt = 490000 - 260000, format('debt %s', s.total_debt);
end $$;

-- B) first sign-in as Hamer
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where username = 'hamer'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id::text from public.profiles where username = 'hamer'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    perform public.complete_driver_onboarding('Hamer Pérez', '3001234567', '1012345678', 'L123456', 'A2',
      public.bogota_today() - 1, 'María Pérez', '3109876543');
    raise exception 'FAIL: expired license accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.complete_driver_onboarding('Hamer Pérez', '3001234567', '1012345678', 'L123456', 'A2',
      public.bogota_today() + 300, 'María Pérez', '3001234567');
    raise exception 'FAIL: emergency contact with the same phone accepted';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform public.complete_driver_onboarding('Hamer Pérez', '300 123 4567', '1.012.345.678', 'L123456', 'A2',
    public.bogota_today() + 300, 'María Pérez', '310 987 6543');
  assert (select onboarded_at is not null and phone = '3001234567' and full_name = 'Hamer Pérez'
            from public.profiles where username = 'hamer'), 'profile completed';
  assert (select national_id = '1012345678' and license_category = 'A2' from public.drivers where id = public.my_driver_id()), 'driver completed';
  perform public.mark_password_changed();
  assert not (select must_change_password from public.profiles where username = 'hamer'), 'password flag cleared';
  -- a driver cannot change rates or create accounts
  begin
    perform public.admin_change_contract_rate('00000000-0000-4000-8000-0000000000c1', public.bogota_today(), 1000);
    raise exception 'FAIL: driver changed the rate';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.admin_create_driver_account('X', 'xyz', null, '1234');
    raise exception 'FAIL: driver created an account';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  assert not exists (select 1 from public.setup_pending()), 'drivers see no admin checklist';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  assert exists (select 1 from auth.users where email = 'hamer@conductores.moto-arriendo.app'), 'login email from username';
  delete from public.notifications;
  perform public.generate_notifications();
  assert exists (select 1 from public.notifications where kind = 'setup' and title = '📝 Falta la moto y el contrato de Jeison'), 'setup notice for Jeison';
  assert exists (select 1 from public.notifications where kind = 'setup' and title like '📝 A la moto ABC12D le falta%'), 'setup notice for docs';
  assert exists (select 1 from public.notifications where kind = 'setup' and title like '📝 Falta subir el contrato firmado de Hamer%'), 'setup notice for signed contract';
  raise notice 'Go-live tests OK';
end $$;
rollback;
