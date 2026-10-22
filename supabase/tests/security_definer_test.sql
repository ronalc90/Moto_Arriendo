-- =============================================================================
-- Automated test: a DRIVER must not be able to run any admin-only function.
-- SECURITY DEFINER functions run as their owner, so a naive "current_user is
-- privileged" check would wrongly let anybody in. Rolls back.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.com');
insert into public.profiles (id, full_name, phone, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'Admin Prueba', null, 'admin', 'a@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'Conductor A', '3000000001', 'driver', null);
insert into public.drivers (id, profile_id, national_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', 'T-1');
insert into public.motorcycles (id, plate, owner_id, purchase_price, purchase_date) values
  ('00000000-0000-4000-8000-0000000000e1', 'PRU01A', '00000000-0000-4000-8000-0000000000a1', 6000000, current_date);

-- Act as the driver, exactly like PostgREST does.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

do $$
declare
  calls text[] := array[
    $q$select public.admin_create_user('x@example.com', 'Clave12345', 'Intruso', 'admin', null)$q$,
    $q$select public.admin_set_password('00000000-0000-4000-8000-0000000000a1', 'Clave12345')$q$,
    $q$select public.admin_create_driver('Intruso', '3001112233', 'Clave12345', 'X-1')$q$,
    $q$select public.admin_set_driver_active('00000000-0000-4000-8000-0000000000d1', false)$q$,
    $q$select public.admin_purge_test_data()$q$
  ];
  q text;
begin
  foreach q in array calls loop
    begin
      execute q;
      raise exception 'SECURITY HOLE: driver ran %', q;
    exception
      when raise_exception then
        if sqlerrm like 'SECURITY HOLE%' then raise; end if;
      when insufficient_privilege then null;
    end;
  end loop;
  assert not public.has_test_data(), 'has_test_data must be false for drivers';
end $$;

reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain SQL-editor session
-- The privileged path (SQL editor / migrations) must keep working.
do $$ begin
  assert public.is_privileged_role(), 'postgres session must be privileged';
end $$;
select 1 from public.motorcycles where plate = 'PRU01A';
do $$ begin raise notice 'Security definer tests OK'; end $$;
rollback;
